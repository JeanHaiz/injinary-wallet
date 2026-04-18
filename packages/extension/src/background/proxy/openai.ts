// ─── OpenAI Provider Proxy ───────────────────────────────────────────────────

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	StreamChunk,
} from "@ai-wallet/shared";
import { ProviderProxy } from "./base.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export class OpenAIProxy extends ProviderProxy {
	readonly id = "openai" as const;
	readonly name = "OpenAI";

	async complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse> {
		const url = `${baseUrl ?? DEFAULT_BASE_URL}/chat/completions`;
		const model = request.model ?? "gpt-4o";

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
			throw new Error(`OpenAI API error (${response.status}): ${error}`);
		}

		const data = await response.json();
		const choice = data.choices?.[0];

		return {
			id: data.id,
			provider: "openai",
			model: data.model,
			content: choice?.message?.content ?? "",
			usage: {
				promptTokens: data.usage?.prompt_tokens ?? 0,
				completionTokens: data.usage?.completion_tokens ?? 0,
				totalTokens: data.usage?.total_tokens ?? 0,
				estimatedCostCents: 0, // Calculated by the caller using pricing tables
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
		const model = request.model ?? "gpt-4o";

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
			throw new Error(`OpenAI API error (${response.status}): ${error}`);
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
		const model = request.model ?? "text-embedding-3-small";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				input: request.input,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI API error (${response.status}): ${error}`);
		}

		const data = await response.json();

		return {
			provider: "openai",
			model: data.model,
			embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
			usage: {
				totalTokens: data.usage?.total_tokens ?? 0,
				estimatedCostCents: 0,
			},
		};
	}

	async listModels(_apiKey: string, _baseUrl?: string): Promise<ModelInfo[]> {
		// Return a curated list rather than hitting /v1/models (which returns hundreds)
		return [
			{
				id: "gpt-4o",
				provider: "openai",
				name: "GPT-4o",
				capabilities: ["chat"],
				contextWindow: 128_000,
			},
			{
				id: "gpt-4o-mini",
				provider: "openai",
				name: "GPT-4o Mini",
				capabilities: ["chat"],
				contextWindow: 128_000,
			},
			{
				id: "text-embedding-3-small",
				provider: "openai",
				name: "Embedding 3 Small",
				capabilities: ["embed"],
			},
			{
				id: "text-embedding-3-large",
				provider: "openai",
				name: "Embedding 3 Large",
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
