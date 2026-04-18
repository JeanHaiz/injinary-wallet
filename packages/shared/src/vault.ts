// ─── Vault & Storage Types ───────────────────────────────────────────────────

import type { ProviderId } from "./provider.js";

/** A stored API key for a provider */
export interface ProviderKey {
	id: string;
	provider: ProviderId;
	label: string;
	apiKey: string;
	baseUrl?: string;
	addedAt: number;
	lastUsedAt: number;
	isDefault: boolean;
}

/** The decrypted vault contents */
export interface KeyVault {
	version: 1;
	keys: ProviderKey[];
}

/** Metadata stored unencrypted (needed before unlock) */
export interface WalletMetadata {
	version: 1;
	createdAt: number;
	lockTimeoutMinutes: number;
}

/** Encryption parameters stored alongside ciphertext */
export interface EncryptedBlob {
	ciphertext: string; // base64
	salt: string; // base64
	iv: string; // base64
	iterations: number;
}

/** Usage log entry */
export interface UsageEntry {
	id: string;
	timestamp: number;
	origin: string;
	provider: ProviderId;
	model: string;
	promptTokens: number;
	completionTokens: number;
	estimatedCostCents: number;
	method: string;
	durationMs: number;
}

/** Aggregated daily usage */
export interface DailyAggregate {
	date: string; // "2026-04-09"
	byOrigin: Record<
		string,
		{
			requests: number;
			totalTokens: number;
			costCents: number;
		}
	>;
	byProvider: Record<
		string,
		{
			requests: number;
			totalTokens: number;
			costCents: number;
		}
	>;
}
