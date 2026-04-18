// ─── Google (Gemini) Provider Proxy ──────────────────────────────────────────

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	StreamChunk,
} from "@injinary-wallet/shared";
import { ProviderProxy } from "./base.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

export class GoogleProxy extends ProviderProxy {
	readonly id = "google" as const;
	readonly name = "Google (Gemini)";

	async complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse> {
		const base = baseUrl ?? DEFAULT_BASE_URL;
		const model = request.model ?? "gemini-2.0-flash";
		const url = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const { systemInstruction, contents } = toGeminiMessages(request);

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents,
				...(systemInstruction ? { systemInstruction } : {}),
				generationConfig: {
					...(request.temperature != null ? { temperature: request.temperature } : {}),
					...(request.maxTokens != null ? { maxOutputTokens: request.maxTokens } : {}),
				},
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google API error (${response.status}): ${error}`);
		}

		const data = await response.json();
		const candidate = data.candidates?.[0];
		const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
		const usage = data.usageMetadata;

		return {
			id: crypto.randomUUID(),
			provider: "google",
			model,
			content: text,
			usage: {
				promptTokens: usage?.promptTokenCount ?? 0,
				completionTokens: usage?.candidatesTokenCount ?? 0,
				totalTokens: usage?.totalTokenCount ?? 0,
				estimatedCostCents: 0,
			},
			finishReason: normalizeFinishReason(candidate?.finishReason),
		};
	}

	async completeStream(
		apiKey: string,
		request: CompletionRequest,
		onChunk: (chunk: StreamChunk) => void,
		baseUrl?: string,
	): Promise<void> {
		const base = baseUrl ?? DEFAULT_BASE_URL;
		const model = request.model ?? "gemini-2.0-flash";
		const url = `${base}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

		const { systemInstruction, contents } = toGeminiMessages(request);

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents,
				...(systemInstruction ? { systemInstruction } : {}),
				generationConfig: {
					...(request.temperature != null ? { temperature: request.temperature } : {}),
					...(request.maxTokens != null ? { maxOutputTokens: request.maxTokens } : {}),
				},
				...request.providerOptions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google API error (${response.status}): ${error}`);
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

				const candidate = parsed.candidates?.[0];
				const text =
					candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

				if (text) {
					onChunk({ id: streamId, content: text, done: false });
				}

				const usage = parsed.usageMetadata;
				if (candidate?.finishReason && candidate.finishReason !== "FINISH_REASON_UNSPECIFIED") {
					onChunk({
						id: streamId,
						content: "",
						done: true,
						usage: usage
							? {
									promptTokens: usage.promptTokenCount ?? 0,
									completionTokens: usage.candidatesTokenCount ?? 0,
									totalTokens: usage.totalTokenCount ?? 0,
									estimatedCostCents: 0,
								}
							: undefined,
					});
				}
			}
		}
	}

	async embed(apiKey: string, request: EmbedRequest, baseUrl?: string): Promise<EmbedResponse> {
		const base = baseUrl ?? DEFAULT_BASE_URL;
		const model = request.model ?? "text-embedding-004";
		const inputs = Array.isArray(request.input) ? request.input : [request.input];

		// Gemini batch embed endpoint
		const url = `${base}/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requests: inputs.map((text) => ({
					model: `models/${model}`,
					content: { parts: [{ text }] },
				})),
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google API error (${response.status}): ${error}`);
		}

		const data = await response.json();

		return {
			provider: "google",
			model,
			embeddings: data.embeddings.map((e: { values: number[] }) => e.values),
			usage: {
				totalTokens: 0, // Gemini embed API doesn't return token counts
				estimatedCostCents: 0,
			},
		};
	}

	async listModels(_apiKey: string, _baseUrl?: string): Promise<ModelInfo[]> {
		return [
			{
				id: "gemini-2.0-flash",
				provider: "google",
				name: "Gemini 2.0 Flash",
				capabilities: ["chat"],
				contextWindow: 1_048_576,
			},
			{
				id: "gemini-2.5-pro",
				provider: "google",
				name: "Gemini 2.5 Pro",
				capabilities: ["chat"],
				contextWindow: 1_048_576,
			},
			{
				id: "text-embedding-004",
				provider: "google",
				name: "Text Embedding 004",
				capabilities: ["embed"],
			},
		];
	}
}

/** Convert our normalized messages to Gemini's content format */
function toGeminiMessages(request: CompletionRequest) {
	const systemMessage = request.messages.find((m) => m.role === "system");
	const systemInstruction = systemMessage
		? { parts: [{ text: systemMessage.content }] }
		: undefined;

	const contents = request.messages
		.filter((m) => m.role !== "system")
		.map((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		}));

	return { systemInstruction, contents };
}

function normalizeFinishReason(reason?: string): "stop" | "length" | "content_filter" {
	switch (reason) {
		case "STOP":
			return "stop";
		case "MAX_TOKENS":
			return "length";
		case "SAFETY":
		case "RECITATION":
			return "content_filter";
		default:
			return "stop";
	}
}
