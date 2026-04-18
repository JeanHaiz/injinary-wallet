// ─── Abstract Provider Proxy ─────────────────────────────────────────────────
// Each AI provider has a concrete implementation that maps our normalized
// request/response format to the provider's API.

import type {
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	ProviderId,
	StreamChunk,
} from "@injinary-wallet/shared";

export abstract class ProviderProxy {
	abstract readonly id: ProviderId;
	abstract readonly name: string;

	/** Make a chat completion request */
	abstract complete(
		apiKey: string,
		request: CompletionRequest,
		baseUrl?: string,
	): Promise<CompletionResponse>;

	/** Make a streaming chat completion request */
	abstract completeStream(
		apiKey: string,
		request: CompletionRequest,
		onChunk: (chunk: StreamChunk) => void,
		baseUrl?: string,
	): Promise<void>;

	/** Create text embeddings */
	abstract embed(apiKey: string, request: EmbedRequest, baseUrl?: string): Promise<EmbedResponse>;

	/** List available models */
	abstract listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]>;
}
