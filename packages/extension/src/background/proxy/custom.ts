// ─── Custom / OpenAI-Compatible Provider Proxy ──────────────────────────────
// Supports any provider that exposes an OpenAI-compatible API (e.g. Ollama,
// vLLM, Together, Groq, LM Studio, etc.). The user must provide a base URL.

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	StreamChunk,
} from "@injinary-wallet/shared";
import { ProviderProxy } from "./base.js";

export class CustomProxy extends ProviderProxy {
	readonly id = "custom" as const;
	readonly name = "Custom (OpenAI-compatible)";

	async complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse> {
		if (!baseUrl) throw new Error("Custom provider requires a base URL");

		const url = `${baseUrl}/chat/completions`;
		const model = request.model ?? "default";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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
			throw new Error(`Custom API error (${response.status}): ${error}`);
		}

		const data = await response.json();
		const choice = data.choices?.[0];

		return {
			id: data.id ?? crypto.randomUUID(),
			provider: "custom",
			model: data.model ?? model,
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
		if (!baseUrl) throw new Error("Custom provider requires a base URL");

		const url = `${baseUrl}/chat/completions`;
		const model = request.model ?? "default";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
			body: JSON.stringify({
				model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.maxTokens,
				stream: true,
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Custom API error (${response.status}): ${error}`);
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
		if (!baseUrl) throw new Error("Custom provider requires a base URL");

		const url = `${baseUrl}/embeddings`;
		const model = request.model ?? "default";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
			body: JSON.stringify({
				model,
				input: request.input,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Custom API error (${response.status}): ${error}`);
		}

		const data = await response.json();

		return {
			provider: "custom",
			model: data.model ?? model,
			embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
			usage: {
				totalTokens: data.usage?.total_tokens ?? 0,
				estimatedCostCents: 0,
			},
		};
	}

	async listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
		if (!baseUrl) return [];

		try {
			const response = await fetch(`${baseUrl}/models`, {
				headers: {
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
				},
			});

			if (!response.ok) return [];

			const data = await response.json();
			const models = data.data ?? data;

			return (Array.isArray(models) ? models : []).map((m: { id: string; name?: string }) => ({
				id: m.id,
				provider: "custom" as const,
				name: m.name ?? m.id,
				capabilities: ["chat" as const],
			}));
		} catch {
			return [];
		}
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
