// ─── Content Script: Injector ─────────────────────────────────────────────────
// Runs in the MAIN world (same as page scripts). Injects the `window.aiWallet`
// global that web apps use to detect and interact with the wallet.
//
// This runs at document_start — before any page scripts — and uses
// Object.defineProperty with configurable: false to prevent page scripts
// from overwriting the wallet object.

import {
	AI_WALLET_RPC,
	AI_WALLET_RPC_RESPONSE,
	type RpcMethod,
	type RpcRequest,
	type RpcResponse,
} from "@ai-wallet/shared";

interface AIWalletGlobal {
	detect(): Promise<{ version: string; capabilities: readonly string[] } | null>;
	isAvailable(): Promise<boolean>;
	connect(params: {
		appName: string;
		appIcon?: string;
		requestedProviders?: string[];
		requestedModels?: string[];
		requestedBudget?: { amount: number; period: string };
	}): Promise<unknown>;
}

let counter = 0;

function sendRpc<R = unknown>(method: RpcMethod, params?: unknown, timeoutMs = 30_000): Promise<R> {
	return new Promise<R>((resolve, reject) => {
		const id = `aiw_inj_${Date.now()}_${++counter}`;
		const request: RpcRequest = {
			type: AI_WALLET_RPC,
			id,
			method,
			params,
		};

		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`AI Wallet request timed out (${method})`));
		}, timeoutMs);

		function handler(event: MessageEvent) {
			if (event.source !== window) return;
			const data = event.data as RpcResponse<R>;
			if (data?.type !== AI_WALLET_RPC_RESPONSE || data.id !== id) return;

			cleanup();
			if (data.error) {
				const err = new Error(data.error.message);
				(err as unknown as Record<string, unknown>).code = data.error.code;
				reject(err);
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

const wallet: AIWalletGlobal = {
	async detect() {
		try {
			return await sendRpc("ai_detectWallet", undefined, 500);
		} catch {
			return null;
		}
	},

	async isAvailable() {
		return (await this.detect()) !== null;
	},

	async connect(params) {
		return sendRpc("ai_requestAccess", params);
	},
};

// Make it non-overwritable to prevent SDK impersonation
Object.defineProperty(window, "aiWallet", {
	value: Object.freeze(wallet),
	writable: false,
	configurable: false,
	enumerable: true,
});
