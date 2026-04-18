// ─── Budget Engine ───────────────────────────────────────────────────────────
// Enforces spending limits and rate limits per-app.

import type { AppPermission } from "@injinary-wallet/shared";
import { getPermission } from "./permissions.js";

/** Per-origin rate limiter state (in-memory, rebuilt from recent usage) */
const rateLimiterState = new Map<
	string,
	{
		requests: { timestamp: number }[];
		tokens: { timestamp: number; count: number }[];
	}
>();

/** Check if a request is within budget. Returns remaining budget in cents. */
export async function checkBudget(
	origin: string,
	estimatedCostCents: number,
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
	const perm = await getPermission(origin);
	if (!perm) return { allowed: false, reason: "No permission" };

	const remaining = perm.budget.amount - perm.budget.spent;
	if (estimatedCostCents > remaining) {
		return {
			allowed: false,
			reason: `Budget exceeded: request costs ~${estimatedCostCents}¢ but only ${remaining}¢ remaining`,
			remaining,
		};
	}

	return { allowed: true, remaining };
}

/** Check rate limits for an origin */
export function checkRateLimit(
	origin: string,
	perm: AppPermission,
): { allowed: boolean; reason?: string } {
	const now = Date.now();
	const windowMs = 60_000; // 1 minute

	let state = rateLimiterState.get(origin);
	if (!state) {
		state = { requests: [], tokens: [] };
		rateLimiterState.set(origin, state);
	}

	// Prune old entries
	state.requests = state.requests.filter((r) => now - r.timestamp < windowMs);
	state.tokens = state.tokens.filter((t) => now - t.timestamp < windowMs);

	if (state.requests.length >= perm.rateLimit.requestsPerMinute) {
		return { allowed: false, reason: "Rate limit: too many requests per minute" };
	}

	const totalTokens = state.tokens.reduce((sum, t) => sum + t.count, 0);
	if (totalTokens >= perm.rateLimit.tokensPerMinute) {
		return { allowed: false, reason: "Rate limit: too many tokens per minute" };
	}

	return { allowed: true };
}

/** Record a completed request for rate limiting and budget tracking */
export function recordRequest(origin: string, tokens: number): void {
	const now = Date.now();
	let state = rateLimiterState.get(origin);
	if (!state) {
		state = { requests: [], tokens: [] };
		rateLimiterState.set(origin, state);
	}
	state.requests.push({ timestamp: now });
	state.tokens.push({ timestamp: now, count: tokens });
}

/** Deduct cost from an app's budget after a successful request */
export async function deductBudget(origin: string, costCents: number): Promise<void> {
	const perm = await getPermission(origin);
	if (!perm) return;

	perm.budget.spent += costCents;

	// Persist updated budget
	const result = await chrome.storage.local.get("app_permissions");
	const perms = (result.app_permissions as Record<string, AppPermission>) ?? {};
	perms[origin] = perm;
	await chrome.storage.local.set({ app_permissions: perms });
}

// ─── Cost Estimation ─────────────────────────────────────────────────────────

/** Rough cost estimation based on message length (before actual API call) */
export function estimateCostCents(
	provider: string,
	model: string,
	inputTokensEstimate: number,
	maxOutputTokens: number,
): number {
	const pricing = MODEL_PRICING[`${provider}/${model}`];
	if (!pricing) {
		// Unknown model — use a conservative estimate
		return Math.ceil(((inputTokensEstimate + maxOutputTokens) / 1000) * 0.5);
	}
	const inputCost = (inputTokensEstimate / 1000) * pricing.inputPer1k;
	const outputCost = (maxOutputTokens / 1000) * pricing.outputPer1k;
	return Math.ceil((inputCost + outputCost) * 100); // convert dollars to cents
}

/** Pricing table — updated with extension releases */
const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
	// OpenAI (USD per 1k tokens)
	"openai/gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
	"openai/gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
	"openai/gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
	// Anthropic
	"anthropic/claude-sonnet-4-20250514": { inputPer1k: 0.003, outputPer1k: 0.015 },
	"anthropic/claude-haiku-4-5-20251001": { inputPer1k: 0.0008, outputPer1k: 0.004 },
	"anthropic/claude-opus-4-20250514": { inputPer1k: 0.015, outputPer1k: 0.075 },
	// Google
	"google/gemini-2.0-flash": { inputPer1k: 0.0001, outputPer1k: 0.0004 },
	"google/gemini-2.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.01 },
	// Mistral
	"mistral/mistral-large-latest": { inputPer1k: 0.002, outputPer1k: 0.006 },
	"mistral/mistral-medium-latest": { inputPer1k: 0.0027, outputPer1k: 0.0081 },
	"mistral/mistral-small-latest": { inputPer1k: 0.001, outputPer1k: 0.003 },
	"mistral/codestral-latest": { inputPer1k: 0.001, outputPer1k: 0.003 },
};
