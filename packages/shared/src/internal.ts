// ─── Internal Messages ───────────────────────────────────────────────────────
// Messages between the popup UI and the background service worker.
// These are NOT part of the public SDK protocol — they use chrome.runtime
// directly and are only available to extension pages.

import type { BudgetPeriod, ProviderId } from "./index.js";

export const INTERNAL_MSG = "AI_WALLET_INTERNAL_UI" as const;

export type InternalMethod =
	// Vault lifecycle
	| "vault_isInitialized"
	| "vault_isUnlocked"
	| "vault_initialize"
	| "vault_unlock"
	| "vault_lock"
	// Key management
	| "keys_list"
	| "keys_add"
	| "keys_remove"
	| "keys_setDefault"
	// Permissions
	| "perms_list"
	| "perms_get"
	| "perms_grant"
	| "perms_revoke"
	// Pending approval (for connect flow)
	| "approval_getPending"
	| "approval_resolve";

export interface InternalRequest<P = unknown> {
	type: typeof INTERNAL_MSG;
	method: InternalMethod;
	params?: P;
}

export interface InternalResponse<R = unknown> {
	result?: R;
	error?: string;
}

// ─── Parameter types ─────────────────────────────────────────────────────────

export interface VaultInitializeParams {
	password: string;
}

export interface VaultUnlockParams {
	password: string;
}

export interface KeyAddParams {
	provider: ProviderId;
	label: string;
	apiKey: string;
	baseUrl?: string;
	isDefault: boolean;
}

export interface KeyRemoveParams {
	id: string;
}

export interface KeySetDefaultParams {
	id: string;
}

export interface PermGrantParams {
	origin: string;
	allowedProviders: ProviderId[];
	allowedModels: string[];
	budgetAmount: number;
	budgetPeriod: BudgetPeriod;
	autoApprove: boolean;
	autoApproveMaxCostCents: number;
	expiresAt: number | null;
}

export interface PermRevokeParams {
	origin: string;
}

export interface ApprovalResolveParams {
	requestId: string;
	approved: boolean;
	/** Only present when approved=true */
	grant?: PermGrantParams;
}

/** A pending approval request that the popup needs to show */
export interface PendingApproval {
	requestId: string;
	origin: string;
	appName: string;
	appIcon?: string;
	requestedProviders?: ProviderId[];
	requestedModels?: string[];
	requestedBudget?: { amount: number; period: string };
	timestamp: number;
}
