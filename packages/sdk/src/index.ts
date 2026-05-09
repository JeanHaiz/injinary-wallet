import type { ConnectParams, PermissionSummary, WalletInfo } from "@injinary-wallet/shared";
import { Connection } from "./connection.js";
import { detect, isAvailable } from "./detect.js";
import { sendRpc } from "./transport.js";

export { Connection } from "./connection.js";
export { detect, isAvailable } from "./detect.js";
export {
	INJINARY_WALLET_INSTALL_URL,
	openInstallPage,
	promptInstallIfMissing,
	showInstallPrompt,
} from "./install-prompt.js";
export type {
	InstallPromptController,
	InstallPromptOptions,
	InstallPromptPosition,
} from "./install-prompt.js";
export { InjinaryWalletError } from "./transport.js";

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
} from "@injinary-wallet/shared";

/**
 * The Injinary Wallet interface — injected as `window.injinaryWallet` by the extension.
 *
 * Usage:
 * ```ts
 * const wallet = window.injinaryWallet;
 * if (wallet) {
 *   const conn = await wallet.connect({ appName: "My App" });
 *   const res = await conn.complete({ messages: [{ role: "user", content: "Hi" }] });
 * }
 * ```
 */
export interface InjinaryWallet {
	detect(): Promise<WalletInfo | null>;
	isAvailable(): Promise<boolean>;
	connect(params: ConnectParams): Promise<Connection>;
}

/** Create the wallet interface object */
export function createInjinaryWallet(): InjinaryWallet {
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

// Global type augmentation for window.injinaryWallet
declare global {
	interface Window {
		injinaryWallet?: InjinaryWallet;
	}
}
