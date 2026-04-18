// ─── Anthropic Provider Proxy ─────────────────────────────────────────────────

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	StreamChunk,
} from "@injinary-wallet/shared";
import { ProviderProxy } from "./base.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

export class AnthropicProxy extends ProviderProxy {
	readonly id = "anthropic" as const;
	readonly name = "Anthropic";

	async complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/v1/messages`;
		const model = request.model ?? "claude-sonnet-4-20250514";

		// Anthropic uses a separate system parameter instead of a system message
		const systemMessage = request.messages.find((m) => m.role === "system");
		const messages = request.messages
			.filter((m) => m.role !== "system")
			.map((m) => ({ role: m.role, content: m.content }));

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": API_VERSION,
				"anthropic-dangerous-direct-browser-access": "true",
			},
			body: JSON.stringify({
				model,
				max_tokens: request.maxTokens ?? 4096,
				messages,
				...(systemMessage ? { system: systemMessage.content } : {}),
				...(request.temperature != null ? { temperature: request.temperature } : {}),
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Anthropic API error (${response.status}): ${error}`);
		}

		const data = await response.json();
		const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

		return {
			id: data.id,
			provider: "anthropic",
			model: data.model,
			content: textBlock?.text ?? "",
			usage: {
				promptTokens: data.usage?.input_tokens ?? 0,
				completionTokens: data.usage?.output_tokens ?? 0,
				totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
				estimatedCostCents: 0,
			},
			finishReason: data.stop_reason === "max_tokens" ? "length" : "stop",
		};
	}

	async completeStream(
		apiKey: string,
		request: CompletionRequest,
		onChunk: (chunk: StreamChunk) => void,
		baseUrl?: string,
	): Promise<void> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/v1/messages`;
		const model = request.model ?? "claude-sonnet-4-20250514";

		const systemMessage = request.messages.find((m) => m.role === "system");
		const messages = request.messages
			.filter((m) => m.role !== "system")
			.map((m) => ({ role: m.role, content: m.content }));

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": API_VERSION,
				"anthropic-dangerous-direct-browser-access": "true",
			},
			body: JSON.stringify({
				model,
				max_tokens: request.maxTokens ?? 4096,
				messages,
				stream: true,
				...(systemMessage ? { system: systemMessage.content } : {}),
				...(request.temperature != null ? { temperature: request.temperature } : {}),
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Anthropic API error (${response.status}): ${error}`);
		}

		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		const streamId = crypto.randomUUID();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (!line.startsWith("data: ")) continue;
				const parsed = JSON.parse(line.slice(6));

				if (parsed.type === "content_block_delta" && parsed.delta?.text) {
					onChunk({ id: streamId, content: parsed.delta.text, done: false });
				}

				if (parsed.type === "message_delta" && parsed.usage) {
					onChunk({
						id: streamId,
						content: "",
						done: true,
						usage: {
							promptTokens: 0, // Anthropic sends input tokens in message_start
							completionTokens: parsed.usage.output_tokens ?? 0,
							totalTokens: parsed.usage.output_tokens ?? 0,
							estimatedCostCents: 0,
						},
					});
				}
			}
		}
	}

	async embed(_apiKey: string, _request: EmbedRequest, _baseUrl?: string): Promise<EmbedResponse> {
		throw new Error("Anthropic does not currently offer an embeddings API");
	}

	async listModels(_apiKey: string, _baseUrl?: string): Promise<ModelInfo[]> {
		return [
			{
				id: "claude-sonnet-4-20250514",
				provider: "anthropic",
				name: "Claude Sonnet 4",
				capabilities: ["chat"],
				contextWindow: 200_000,
			},
			{
				id: "claude-haiku-4-5-20251001",
				provider: "anthropic",
				name: "Claude Haiku 4.5",
				capabilities: ["chat"],
				contextWindow: 200_000,
			},
			{
				id: "claude-opus-4-20250514",
				provider: "anthropic",
				name: "Claude Opus 4",
				capabilities: ["chat"],
				contextWindow: 200_000,
			},
		];
	}
}
