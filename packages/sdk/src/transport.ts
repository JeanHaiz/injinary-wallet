import {
	AI_WALLET_RPC,
	AI_WALLET_RPC_RESPONSE,
	type RpcError,
	type RpcMethod,
	type RpcRequest,
	type RpcResponse,
} from "@ai-wallet/shared";

/** Error thrown when an RPC call fails */
export class AIWalletError extends Error {
	constructor(
		public readonly code: number,
		message: string,
		public readonly data?: unknown,
	) {
		super(message);
		this.name = "AIWalletError";
	}

	static fromRpcError(err: RpcError): AIWalletError {
		return new AIWalletError(err.code, err.message, err.data);
	}
}

let counter = 0;
function nextId(): string {
	return `aiw_${Date.now()}_${++counter}`;
}

/**
 * Send a JSON-RPC request to the wallet extension via postMessage.
 * Returns a promise that resolves with the result or rejects with AIWalletError.
 */
export function sendRpc<P, R>(method: RpcMethod, params: P, timeoutMs = 30_000): Promise<R> {
	return new Promise<R>((resolve, reject) => {
		const id = nextId();
		const request: RpcRequest<P> = {
			type: AI_WALLET_RPC,
			id,
			method,
			params,
		};

		const timer = setTimeout(() => {
			cleanup();
			reject(new AIWalletError(-32603, `Request ${method} timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		function handler(event: MessageEvent) {
			if (event.source !== window) return;
			const data = event.data as RpcResponse<R>;
			if (data?.type !== AI_WALLET_RPC_RESPONSE || data.id !== id) return;

			cleanup();
			if (data.error) {
				reject(AIWalletError.fromRpcError(data.error));
			} else {
				resolve(data.result as R);
			}
		}

		function cleanup() {
			clearTimeout(timer);
			window.removeEventListener("message", handler);
		}

		window.addEventListener("message", handler);
		window.postMessage(request, "*");
	});
}

/**
 * Send a streaming RPC request. Returns a MessagePort that receives StreamChunk messages.
 * The caller transfers one port to the content script; the extension sends chunks on the other.
 */
export function sendStreamRpc<P>(
	method: RpcMethod,
	params: P,
	timeoutMs = 30_000,
): { port: MessagePort; ready: Promise<void> } {
	const channel = new MessageChannel();
	const id = nextId();
	const request: RpcRequest<P> = {
		type: AI_WALLET_RPC,
		id,
		method,
		params,
	};

	// Transfer one port to the content script via postMessage
	window.postMessage(request, "*", [channel.port2]);

	const ready = new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new AIWalletError(-32603, `Stream ${method} timed out waiting for ack`));
		}, timeoutMs);

		function handler(event: MessageEvent) {
			if (event.source !== window) return;
			const data = event.data as RpcResponse;
			if (data?.type !== AI_WALLET_RPC_RESPONSE || data.id !== id) return;

			clearTimeout(timer);
			window.removeEventListener("message", handler);

			if (data.error) {
				reject(AIWalletError.fromRpcError(data.error));
			} else {
				resolve();
			}
		}

		window.addEventListener("message", handler);
	});

	return { port: channel.port1, ready };
}
