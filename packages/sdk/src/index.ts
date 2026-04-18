import type { ConnectParams, PermissionSummary, WalletInfo } from "@ai-wallet/shared";
import { Connection } from "./connection.js";
import { detect, isAvailable } from "./detect.js";
import { sendRpc } from "./transport.js";

export { Connection } from "./connection.js";
export { detect, isAvailable } from "./detect.js";
export { AIWalletError } from "./transport.js";

// Re-export shared types that app developers need
export type {
	BudgetStatus,
	ChatMessage,
	CompletionRequest,
	CompletionResponse,
	ConnectParams,
	EmbedRequest,
	EmbedResponse,
	ModelInfo,
	PermissionSummary,
	StreamChunk,
	TokenUsage,
	WalletInfo,
} from "@ai-wallet/shared";

/**
 * The AI Wallet interface — injected as `window.aiWallet` by the extension.
 *
 * Usage:
 * ```ts
 * const wallet = window.aiWallet;
 * if (wallet) {
 *   const conn = await wallet.connect({ appName: "My App" });
 *   const res = await conn.complete({ messages: [{ role: "user", content: "Hi" }] });
 * }
 * ```
 */
export interface AIWallet {
	detect(): Promise<WalletInfo | null>;
	isAvailable(): Promise<boolean>;
	connect(params: ConnectParams): Promise<Connection>;
}

/** Create the wallet interface object */
export function createAIWallet(): AIWallet {
	return {
		detect,
		isAvailable,
		async connect(params: ConnectParams): Promise<Connection> {
			const permissions = await sendRpc<ConnectParams, PermissionSummary>(
				"ai_requestAccess",
				params,
			);
			return new Connection(permissions);
		},
	};
}

// Global type augmentation for window.aiWallet
declare global {
	interface Window {
		aiWallet?: AIWallet;
	}
}
