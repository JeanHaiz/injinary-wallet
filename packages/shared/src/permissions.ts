// ─── Permission & Budget Model ───────────────────────────────────────────────

import type { ProviderId } from "./provider.js";

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "total";

export interface BudgetLimit {
	/** Maximum spend in USD cents */
	amount: number;
	period: BudgetPeriod;
	/** Current spend in this period (cents) */
	spent: number;
	/** Start of the current period (epoch ms) */
	periodStart: number;
}

export interface RateLimit {
	requestsPerMinute: number;
	tokensPerMinute: number;
}

/** Permission grant for a single app origin */
export interface AppPermission {
	origin: string;
	grantedAt: number;
	expiresAt: number | null;
	allowedProviders: ProviderId[];
	allowedModels: string[];
	budget: BudgetLimit;
	rateLimit: RateLimit;
	/** If true, requests below autoApproveMaxCostCents skip the confirmation popup */
	autoApprove: boolean;
	autoApproveMaxCostCents: number;
}

/** What the SDK receives after connecting (no internal state like periodStart) */
export interface PermissionSummary {
	origin: string;
	allowedProviders: ProviderId[];
	allowedModels: string[];
	budgetRemaining: number;
	budgetLimit: number;
	budgetPeriod: BudgetPeriod;
	autoApprove: boolean;
}

/** Budget status returned by ai_getBudget */
export interface BudgetStatus {
	limit: number;
	spent: number;
	remaining: number;
	period: BudgetPeriod;
	periodStart: number;
	periodEnd: number;
}

/** Params the app sends when requesting access */
export interface ConnectParams {
	appName: string;
	appIcon?: string;
	requestedProviders?: ProviderId[];
	requestedModels?: string[];
	requestedBudget?: {
		amount: number;
		period: BudgetPeriod;
	};
}
