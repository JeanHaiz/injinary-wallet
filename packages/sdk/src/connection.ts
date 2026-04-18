import type {
	BudgetStatus,
	CompletionRequest,
	CompletionResponse,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	PermissionSummary,
	StreamChunk,
	UsageEntry,
} from "@ai-wallet/shared";
import { AIWalletError, sendRpc, sendStreamRpc } from "./transport.js";

export type ConnectionEventMap = {
	budgetWarning: { remaining: number };
	disconnected: undefined;
	permissionsChanged: PermissionSummary;
};

type EventHandler<T> = (data: T) => void;

/**
 * A connection to the AI Wallet, obtained after the user approves access.
 * All AI operations go through this object.
 */
export class Connection {
	private listeners = new Map<string, Set<EventHandler<unknown>>>();
	private _connected = true;

	constructor(public readonly permissions: PermissionSummary) {}

	get connected(): boolean {
		return this._connected;
	}

	// ─── AI Operations ───────────────────────────────────────────────────

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		this.assertConnected();
		return sendRpc<CompletionRequest, CompletionResponse>("ai_complete", request);
	}

	async *completeStream(request: CompletionRequest): AsyncIterable<StreamChunk> {
		this.assertConnected();
		const { port, ready } = sendStreamRpc<CompletionRequest>("ai_completeStream", request);

		await ready;

		try {
			yield* this.readPort(port);
		} finally {
			port.close();
		}
	}

	async embed(request: EmbedRequest): Promise<EmbedResponse> {
		this.assertConnected();
		return sendRpc<EmbedRequest, EmbedResponse>("ai_embed", request);
	}

	// ─── Introspection ──────────────────────────────────────────────────

	async listModels(): Promise<ModelInfo[]> {
		this.assertConnected();
		return sendRpc<undefined, ModelInfo[]>("ai_listModels", undefined);
	}

	async getPermissions(): Promise<PermissionSummary> {
		this.assertConnected();
		return sendRpc<undefined, PermissionSummary>("ai_getPermissions", undefined);
	}

	async getBudget(): Promise<BudgetStatus> {
		this.assertConnected();
		return sendRpc<undefined, BudgetStatus>("ai_getBudget", undefined);
	}

	async getUsage(options?: { limit?: number; since?: number }): Promise<UsageEntry[]> {
		this.assertConnected();
		return sendRpc<typeof options, UsageEntry[]>("ai_getUsage", options);
	}

	// ─── Events ─────────────────────────────────────────────────────────

	on<K extends keyof ConnectionEventMap>(
		event: K,
		handler: EventHandler<ConnectionEventMap[K]>,
	): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const handlers = this.listeners.get(event)!;
		handlers.add(handler as EventHandler<unknown>);
		return () => handlers.delete(handler as EventHandler<unknown>);
	}

	/** @internal */
	emit<K extends keyof ConnectionEventMap>(event: K, data: ConnectionEventMap[K]): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			for (const h of handlers) h(data);
		}
	}

	// ─── Lifecycle ──────────────────────────────────────────────────────

	disconnect(): void {
		this._connected = false;
		this.emit("disconnected", undefined);
		this.listeners.clear();
	}

	// ─── Private ────────────────────────────────────────────────────────

	private assertConnected(): void {
		if (!this._connected) {
			throw new AIWalletError(4200, "Not connected to AI Wallet");
		}
	}

	private async *readPort(port: MessagePort): AsyncIterable<StreamChunk> {
		// Convert MessagePort events to an async iterable
		const queue: StreamChunk[] = [];
		let resolve: (() => void) | null = null;
		let done = false;

		port.onmessage = (event: MessageEvent<StreamChunk>) => {
			const chunk = event.data;
			queue.push(chunk);
			if (chunk.done) done = true;
			resolve?.();
		};

		port.start();

		while (true) {
			if (queue.length > 0) {
				const chunk = queue.shift()!;
				yield chunk;
				if (chunk.done) return;
			} else if (done) {
				return;
			} else {
				await new Promise<void>((r) => {
					resolve = r;
				});
			}
		}
	}
}
