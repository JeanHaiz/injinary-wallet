// ─── Shared Constants ────────────────────────────────────────────────────────

/** Default PBKDF2 iterations for key derivation */
export const PBKDF2_ITERATIONS = 600_000;

/** Default auto-lock timeout in minutes */
export const DEFAULT_LOCK_TIMEOUT_MINUTES = 15;

/** Max usage log entries before oldest are pruned */
export const MAX_USAGE_LOG_ENTRIES = 10_000;

/** Max daily aggregates to keep (12 months) */
export const MAX_DAILY_AGGREGATES = 365;

/** Default rate limits for new app permissions */
export const DEFAULT_RATE_LIMIT = {
	requestsPerMinute: 20,
	tokensPerMinute: 100_000,
} as const;

/** Wallet version for capability detection */
export const WALLET_VERSION = "0.1.0";

/** Capabilities advertised by ai_detectWallet */
export const WALLET_CAPABILITIES = ["chat", "embed", "stream", "budget"] as const;
export type WalletCapability = (typeof WALLET_CAPABILITIES)[number];

/** Detection result from ai_detectWallet */
export interface WalletInfo {
	version: string;
	capabilities: readonly WalletCapability[];
}
