// ─── Mistral Provider Proxy ──────────────────────────────────────────────────

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	StreamChunk,
} from "@injinary-wallet/shared";
import { ProviderProxy } from "./base.js";

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

export class MistralProxy extends ProviderProxy {
	readonly id = "mistral" as const;
	readonly name = "Mistral";

	async complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/chat/completions`;
		const model = request.model ?? "mistral-large-latest";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.maxTokens,
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Mistral API error (${response.status}): ${error}`);
		}

		const data = await response.json();
		const choice = data.choices?.[0];

		return {
			id: data.id,
			provider: "mistral",
			model: data.model,
			content: choice?.message?.content ?? "",
			usage: {
				promptTokens: data.usage?.prompt_tokens ?? 0,
				completionTokens: data.usage?.completion_tokens ?? 0,
				totalTokens: data.usage?.total_tokens ?? 0,
				estimatedCostCents: 0,
			},
			finishReason: normalizeFinishReason(choice?.finish_reason),
		};
	}

	async completeStream(
		apiKey: string,
		request: CompletionRequest,
		onChunk: (chunk: StreamChunk) => void,
		baseUrl?: string,
	): Promise<void> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/chat/completions`;
		const model = request.model ?? "mistral-large-latest";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Mistral API error (${response.status}): ${error}`);
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
				const payload = line.slice(6).trim();
				if (payload === "[DONE]") {
					onChunk({ id: streamId, content: "", done: true });
					return;
				}

				const parsed = JSON.parse(payload);
				const delta = parsed.choices?.[0]?.delta;
				const usage = parsed.usage;

				if (delta?.content) {
					onChunk({
						id: streamId,
						content: delta.content,
						done: false,
					});
				}

				if (usage) {
					onChunk({
						id: streamId,
						content: "",
						done: true,
						usage: {
							promptTokens: usage.prompt_tokens ?? 0,
							completionTokens: usage.completion_tokens ?? 0,
							totalTokens: usage.total_tokens ?? 0,
							estimatedCostCents: 0,
						},
					});
				}
			}
		}
	}

	async embed(apiKey: string, request: EmbedRequest, baseUrl?: string): Promise<EmbedResponse> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/embeddings`;
		const model = request.model ?? "mistral-embed";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				input: Array.isArray(request.input) ? request.input : [request.input],
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Mistral API error (${response.status}): ${error}`);
		}

		const data = await response.json();

		return {
			provider: "mistral",
			model: data.model,
			embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
			usage: {
				totalTokens: data.usage?.total_tokens ?? 0,
				estimatedCostCents: 0,
			},
		};
	}

	async listModels(_apiKey: string, _baseUrl?: string): Promise<ModelInfo[]> {
		return [
			{
				id: "mistral-large-latest",
				provider: "mistral",
				name: "Mistral Large",
				capabilities: ["chat"],
				contextWindow: 128_000,
			},
			{
				id: "mistral-medium-latest",
				provider: "mistral",
				name: "Mistral Medium",
				capabilities: ["chat"],
				contextWindow: 128_000,
			},
			{
				id: "mistral-small-latest",
				provider: "mistral",
				name: "Mistral Small",
				capabilities: ["chat"],
				contextWindow: 128_000,
			},
			{
				id: "codestral-latest",
				provider: "mistral",
				name: "Codestral",
				capabilities: ["chat"],
				contextWindow: 256_000,
			},
			{
				id: "mistral-embed",
				provider: "mistral",
				name: "Mistral Embed",
				capabilities: ["embed"],
			},
		];
	}
}

function normalizeFinishReason(reason?: string): "stop" | "length" | "content_filter" {
	switch (reason) {
		case "stop":
			return "stop";
		case "length":
			return "length";
		case "content_filter":
			return "content_filter";
		default:
			return "stop";
	}
}
