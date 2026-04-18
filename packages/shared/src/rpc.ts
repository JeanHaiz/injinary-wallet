// ─── JSON-RPC Protocol ───────────────────────────────────────────────────────
// Modeled after EIP-1193 (Ethereum Provider), adapted for AI services.
// All messages between the SDK and extension follow this shape.

export const AI_WALLET_RPC = "AI_WALLET_RPC" as const;
export const AI_WALLET_RPC_RESPONSE = "AI_WALLET_RPC_RESPONSE" as const;

/** RPC methods — namespaced to allow future extension (e.g. storage_*) */
export type RpcMethod =
	// Discovery & connection
	| "ai_detectWallet"
	| "ai_requestAccess"
	| "ai_revokeAccess"
	| "ai_getPermissions"
	// AI operations
	| "ai_complete"
	| "ai_completeStream"
	| "ai_embed"
	| "ai_listModels"
	// Budget & usage
	| "ai_getBudget"
	| "ai_getUsage";

/** Message sent from SDK (page) → content script → service worker */
export interface RpcRequest<P = unknown> {
	type: typeof AI_WALLET_RPC;
	id: string;
	method: RpcMethod;
	params: P;
}

/** Message sent from service worker → content script → SDK (page) */
export interface RpcResponse<R = unknown> {
	type: typeof AI_WALLET_RPC_RESPONSE;
	id: string;
	result?: R;
	error?: RpcError;
	streaming?: boolean;
}

export interface RpcError {
	code: RpcErrorCode;
	message: string;
	data?: unknown;
}

export enum RpcErrorCode {
	// Standard JSON-RPC
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603,

	// AI Wallet specific
	WalletLocked = 4001,
	PermissionDenied = 4002,
	BudgetExceeded = 4003,
	RateLimited = 4004,
	ProviderError = 4005,
	UserRejected = 4100,
	NotConnected = 4200,
}
