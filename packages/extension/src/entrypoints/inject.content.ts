import {
	AI_WALLET_RPC,
	AI_WALLET_RPC_RESPONSE,
	type RpcMethod,
	type RpcRequest,
	type RpcResponse,
} from "@ai-wallet/shared";
import { defineContentScript } from "wxt/sandbox";

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_start",
	world: "MAIN",

	main() {
		let counter = 0;

		function sendRpc<R = unknown>(
			method: RpcMethod,
			params?: unknown,
			timeoutMs = 30_000,
		): Promise<R> {
			return new Promise<R>((resolve, reject) => {
				const id = `aiw_inj_${Date.now()}_${++counter}`;
				const request: RpcRequest = { type: AI_WALLET_RPC, id, method, params };

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
						(err as any).code = data.error.code;
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

		const wallet = {
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
			async connect(params: {
				appName: string;
				appIcon?: string;
				requestedProviders?: string[];
				requestedModels?: string[];
				requestedBudget?: { amount: number; period: string };
			}) {
				return sendRpc("ai_requestAccess", params);
			},
		};

		Object.defineProperty(window, "aiWallet", {
			value: Object.freeze(wallet),
			writable: false,
			configurable: false,
			enumerable: true,
		});
	},
});
