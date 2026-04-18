// ─── Popup → Background API ──────────────────────────────────────────────────
// Helper to send internal messages from the popup to the service worker.

import {
	INTERNAL_MSG,
	type InternalMethod,
	type InternalRequest,
	type InternalResponse,
} from "@injinary-wallet/shared";

export async function send<R = unknown>(method: InternalMethod, params?: unknown): Promise<R> {
	const message: InternalRequest = {
		type: INTERNAL_MSG,
		method,
		params,
	};

	const response: InternalResponse<R> = await chrome.runtime.sendMessage(message);

	if (response.error) {
		throw new Error(response.error);
	}

	return response.result as R;
}

// ─── Typed API ───────────────────────────────────────────────────────────────

export const vault = {
	isInitialized: () => send<boolean>("vault_isInitialized"),
	isUnlocked: () => send<boolean>("vault_isUnlocked"),
	initialize: (password: string) => send("vault_initialize", { password }),
	unlock: (password: string) => send("vault_unlock", { password }),
	lock: () => send("vault_lock"),
};

export const keys = {
	list: () =>
		send<
			{
				id: string;
				provider: string;
				label: string;
				apiKey: string;
				isDefault: boolean;
				addedAt: number;
			}[]
		>("keys_list"),
	add: (params: {
		provider: string;
		label: string;
		apiKey: string;
		baseUrl?: string;
		isDefault: boolean;
	}) => send("keys_add", params),
	remove: (id: string) => send("keys_remove", { id }),
	setDefault: (id: string) => send("keys_setDefault", { id }),
};

export const perms = {
	list: () => send<unknown[]>("perms_list"),
	revoke: (origin: string) => send("perms_revoke", { origin }),
};

export const approval = {
	getPending: () =>
		send<
			{
				requestId: string;
				origin: string;
				appName: string;
				appIcon?: string;
				requestedProviders?: string[];
				requestedBudget?: { amount: number; period: string };
				timestamp: number;
			}[]
		>("approval_getPending"),
	resolve: (params: {
		requestId: string;
		approved: boolean;
		grant?: {
			origin: string;
			allowedProviders: string[];
			allowedModels: string[];
			budgetAmount: number;
			budgetPeriod: string;
			autoApprove: boolean;
			autoApproveMaxCostCents: number;
			expiresAt: number | null;
		};
	}) => send("approval_resolve", params),
};
