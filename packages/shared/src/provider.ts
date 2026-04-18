// ─── AI Provider Types ───────────────────────────────────────────────────────

export type ProviderId = "openai" | "anthropic" | "google" | "mistral" | "custom";

/** A message in a chat conversation (provider-agnostic) */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/** Request for chat completion */
export interface CompletionRequest {
	provider?: ProviderId;
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	/** Pass-through for provider-specific options the wallet doesn't normalize */
	providerOptions?: Record<string, unknown>;
}

/** Normalized completion response (same shape regardless of provider) */
export interface CompletionResponse {
	id: string;
	provider: ProviderId;
	model: string;
	content: string;
	usage: TokenUsage;
	finishReason: "stop" | "length" | "content_filter";
}

/** A single chunk in a streaming response */
export interface StreamChunk {
	id: string;
	content: string;
	done: boolean;
	/** Only present on the final chunk */
	usage?: TokenUsage;
}

/** Token usage with cost estimate */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	estimatedCostCents: number;
}

/** Request for text embeddings */
export interface EmbedRequest {
	provider?: ProviderId;
	model?: string;
	input: string | string[];
}

/** Normalized embedding response */
export interface EmbedResponse {
	provider: ProviderId;
	model: string;
	embeddings: number[][];
	usage: {
		totalTokens: number;
		estimatedCostCents: number;
	};
}

/** Model descriptor returned by ai_listModels */
export interface ModelInfo {
	id: string;
	provider: ProviderId;
	name: string;
	capabilities: ("chat" | "embed")[];
	contextWindow?: number;
	costPer1kInput?: number;
	costPer1kOutput?: number;
}
