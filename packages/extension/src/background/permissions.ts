// ─── Permission Manager ──────────────────────────────────────────────────────
// Manages per-origin permissions: what providers/models an app can use,
// budget limits, and rate limits.

import type {
	AppPermission,
	BudgetPeriod,
	BudgetStatus,
	ConnectParams,
	PermissionSummary,
	ProviderId,
} from "@injinary-wallet/shared";
import { DEFAULT_RATE_LIMIT } from "@injinary-wallet/shared";

const STORAGE_KEY = "app_permissions";

/** In-memory cache of permissions, loaded from storage on startup */
let permissionCache: Record<string, AppPermission> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
	if (loaded) return;
	const result = await chrome.storage.local.get(STORAGE_KEY);
	permissionCache = (result[STORAGE_KEY] as Record<string, AppPermission>) ?? {};
	loaded = true;
}

async function persist(): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: permissionCache });
}

/** Get permission for an origin, or null if not granted */
export async function getPermission(origin: string): Promise<AppPermission | null> {
	await ensureLoaded();
	const perm = permissionCache[origin];
	if (!perm) return null;

	// Check expiry
	if (perm.expiresAt && Date.now() > perm.expiresAt) {
		delete permissionCache[origin];
		await persist();
		return null;
	}

	return perm;
}

/** Grant permission to an origin based on connect params and user choices */
export async function grantPermission(
	origin: string,
	_params: ConnectParams,
	userChoices: {
		allowedProviders: ProviderId[];
		allowedModels: string[];
		budgetAmount: number;
		budgetPeriod: BudgetPeriod;
		autoApprove: boolean;
		autoApproveMaxCostCents: number;
		expiresAt: number | null;
	},
): Promise<AppPermission> {
	await ensureLoaded();

	const permission: AppPermission = {
		origin,
		grantedAt: Date.now(),
		expiresAt: userChoices.expiresAt,
		allowedProviders: userChoices.allowedProviders,
		allowedModels: userChoices.allowedModels,
		budget: {
			amount: userChoices.budgetAmount,
			period: userChoices.budgetPeriod,
			spent: 0,
			periodStart: Date.now(),
		},
		rateLimit: { ...DEFAULT_RATE_LIMIT },
		autoApprove: userChoices.autoApprove,
		autoApproveMaxCostCents: userChoices.autoApproveMaxCostCents,
	};

	permissionCache[origin] = permission;
	await persist();
	return permission;
}

/** Revoke permission for an origin */
export async function revokePermission(origin: string): Promise<void> {
	await ensureLoaded();
	delete permissionCache[origin];
	await persist();
}

/** Check if a specific request is allowed by the origin's permissions */
export async function checkPermission(
	origin: string,
	provider: ProviderId,
	model: string,
): Promise<{ allowed: boolean; reason?: string }> {
	const perm = await getPermission(origin);
	if (!perm) return { allowed: false, reason: "No permission granted" };

	if (!perm.allowedProviders.includes(provider)) {
		return { allowed: false, reason: `Provider "${provider}" not allowed` };
	}

	if (!perm.allowedModels.includes("*") && !perm.allowedModels.includes(model)) {
		return { allowed: false, reason: `Model "${model}" not allowed` };
	}

	return { allowed: true };
}

/** Build a public-facing permission summary (no internal state exposed) */
export function toSummary(perm: AppPermission): PermissionSummary {
	return {
		origin: perm.origin,
		allowedProviders: perm.allowedProviders,
		allowedModels: perm.allowedModels,
		budgetRemaining: Math.max(0, perm.budget.amount - perm.budget.spent),
		budgetLimit: perm.budget.amount,
		budgetPeriod: perm.budget.period,
		autoApprove: perm.autoApprove,
	};
}

/** Get budget status for an origin */
export async function getBudgetStatus(origin: string): Promise<BudgetStatus | null> {
	const perm = await getPermission(origin);
	if (!perm) return null;

	// Reset budget if period has elapsed
	await maybeResetBudgetPeriod(perm);

	return {
		limit: perm.budget.amount,
		spent: perm.budget.spent,
		remaining: Math.max(0, perm.budget.amount - perm.budget.spent),
		period: perm.budget.period,
		periodStart: perm.budget.periodStart,
		periodEnd: computePeriodEnd(perm.budget.periodStart, perm.budget.period),
	};
}

/** Get all granted permissions */
export async function getAllPermissions(): Promise<AppPermission[]> {
	await ensureLoaded();
	return Object.values(permissionCache);
}

// ─── Budget Period Helpers ───────────────────────────────────────────────────

async function maybeResetBudgetPeriod(perm: AppPermission): Promise<void> {
	const periodEnd = computePeriodEnd(perm.budget.periodStart, perm.budget.period);
	if (Date.now() >= periodEnd) {
		perm.budget.spent = 0;
		perm.budget.periodStart = Date.now();
		await persist();
	}
}

function computePeriodEnd(periodStart: number, period: BudgetPeriod): number {
	const start = new Date(periodStart);
	switch (period) {
		case "daily":
			return new Date(start.getTime() + 24 * 60 * 60 * 1000).getTime();
		case "weekly":
			return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).getTime();
		case "monthly":
			return new Date(start.getFullYear(), start.getMonth() + 1, start.getDate()).getTime();
		case "total":
			return Number.MAX_SAFE_INTEGER;
	}
}
