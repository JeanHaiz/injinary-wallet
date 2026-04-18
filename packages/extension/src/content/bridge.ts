// ─── Content Script: Bridge ──────────────────────────────────────────────────
// Runs in the ISOLATED world. Bridges messages between the page's postMessage
// (from the SDK) and chrome.runtime.sendMessage (to the service worker).
//
// Security: This script validates message shape before forwarding. The service
// worker verifies the tab's actual origin (which the page cannot forge).

import {
	AI_WALLET_RPC,
	AI_WALLET_RPC_RESPONSE,
	type RpcMethod,
	type RpcRequest,
	type RpcResponse,
} from "@ai-wallet/shared";

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

// Listen for messages from the page (sent by the SDK via window.postMessage)
window.addEventListener("message", (event: MessageEvent) => {
	// Only accept messages from the same window (the page)
	if (event.source !== window) return;

	const data = event.data as RpcRequest;

	// Validate message shape
	if (data?.type !== AI_WALLET_RPC) return;
	if (typeof data.id !== "string") return;
	if (!VALID_METHODS.has(data.method)) return;

	// Forward to service worker via chrome.runtime (MV3 promise-based API)
	chrome.runtime
		.sendMessage({
			type: "AI_WALLET_INTERNAL",
			rpcMethod: data.method,
			rpcId: data.id,
			params: data.params,
			origin: window.location.origin,
		})
		.then((response: { result?: unknown; error?: { code: number; message: string } }) => {
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
				error: {
					code: -32603,
					message: "AI Wallet extension not available",
				},
			};
			window.postMessage(errorResponse, "*");
		});
});
