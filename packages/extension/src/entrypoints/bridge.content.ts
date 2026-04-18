import {
	AI_WALLET_RPC,
	AI_WALLET_RPC_RESPONSE,
	type RpcMethod,
	type RpcRequest,
	type RpcResponse,
} from "@ai-wallet/shared";
import { defineContentScript } from "wxt/sandbox";

const VALID_METHODS = new Set<RpcMethod>([
	"ai_detectWallet",
	"ai_requestAccess",
	"ai_revokeAccess",
	"ai_getPermissions",
	"ai_complete",
	"ai_completeStream",
	"ai_embed",
	"ai_listModels",
	"ai_getBudget",
	"ai_getUsage",
]);

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_start",
	world: "ISOLATED",

	main(_ctx) {
		window.addEventListener("message", (event: MessageEvent) => {
			if (event.source !== window) return;

			const data = event.data as RpcRequest;
			if (data?.type !== AI_WALLET_RPC) return;
			if (typeof data.id !== "string") return;
			if (!VALID_METHODS.has(data.method)) return;

			browser.runtime
				.sendMessage({
					type: "AI_WALLET_INTERNAL",
					rpcMethod: data.method,
					rpcId: data.id,
					params: data.params,
					origin: window.location.origin,
				})
				.then((raw: unknown) => {
					const response = raw as { result?: unknown; error?: { code: number; message: string } };
					const rpcResponse: RpcResponse = {
						type: AI_WALLET_RPC_RESPONSE,
						id: data.id,
						result: response?.result,
						error: response?.error,
					};
					window.postMessage(rpcResponse, "*");
				})
				.catch(() => {
					const errorResponse: RpcResponse = {
						type: AI_WALLET_RPC_RESPONSE,
						id: data.id,
						error: { code: -32603, message: "AI Wallet extension not available" },
					};
					window.postMessage(errorResponse, "*");
				});
		});
	},
});
