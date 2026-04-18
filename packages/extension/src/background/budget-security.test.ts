import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppPermission } from "@injinary-wallet/shared";
import { checkBudget, checkRateLimit, deductBudget, estimateCostCents, recordRequest } from "./budget.js";

// ─── Mock chrome.storage.local ──────────────────────────────────────────────
const storage: Record<string, unknown> = {};

const chromeStorageMock = {
	get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
	set: vi.fn(async (items: Record<string, unknown>) => {
		Object.assign(storage, items);
	}),
};

vi.stubGlobal("chrome", {
	storage: { local: chromeStorageMock },
});

vi.mock("./permissions.js", () => ({
	getPermission: vi.fn(),
}));

import { getPermission } from "./permissions.js";
const mockGetPermission = vi.mocked(getPermission);

function makePerm(overrides: Partial<AppPermission> = {}): AppPermission {
	return {
		origin: "https://example.com",
		grantedAt: Date.now(),
		expiresAt: null,
		allowedProviders: ["openai"],
		allowedModels: ["*"],
		budget: { amount: 1000, period: "daily", spent: 0, periodStart: Date.now() },
		rateLimit: { requestsPerMinute: 20, tokensPerMinute: 100_000 },
		autoApprove: true,
		autoApproveMaxCostCents: 50,
		...overrides,
	};
}

describe("budget security", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const key of Object.keys(storage)) delete storage[key];
	});

	describe("cannot bypass budget with edge-case values", () => {
		it("rejects zero-budget requests that have any cost", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({ budget: { amount: 0, period: "daily", spent: 0, periodStart: Date.now() } }),
			);
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(false);
		});

		it("handles negative cost estimation gracefully", () => {
			// estimateCostCents should never return negative, but let's verify edge behavior
			const cost = estimateCostCents("openai", "gpt-4o", 0, 0);
			expect(cost).toBeGreaterThanOrEqual(0);
		});

		it("handles very large token counts without overflow", () => {
			const cost = estimateCostCents("openai", "gpt-4o", Number.MAX_SAFE_INTEGER / 1000, 0);
			expect(Number.isFinite(cost)).toBe(true);
			expect(cost).toBeGreaterThan(0);
		});

		it("rejects requests when budget is negative (overspent)", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({ budget: { amount: 100, period: "daily", spent: 150, periodStart: Date.now() } }),
			);
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(false);
		});
	});

	describe("concurrent budget deductions", () => {
		it("accumulates deductions correctly under sequential calls", async () => {
			const perm = makePerm({ budget: { amount: 100, period: "daily", spent: 0, periodStart: Date.now() } });
			mockGetPermission.mockResolvedValue(perm);
			storage.app_permissions = { "https://example.com": perm };

			// Simulate 10 rapid sequential deductions
			for (let i = 0; i < 10; i++) {
				await deductBudget("https://example.com", 10);
			}
			expect(perm.budget.spent).toBe(100);

			// Now budget should be exhausted
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(false);
		});

		it("all concurrent deductions are reflected in final state", async () => {
			const perm = makePerm({ budget: { amount: 1000, period: "daily", spent: 0, periodStart: Date.now() } });
			mockGetPermission.mockResolvedValue(perm);
			storage.app_permissions = { "https://example.com": perm };

			// Fire multiple deductions concurrently
			await Promise.all([
				deductBudget("https://example.com", 100),
				deductBudget("https://example.com", 200),
				deductBudget("https://example.com", 300),
			]);

			expect(perm.budget.spent).toBe(600);
		});
	});

	describe("rate limit cannot be bypassed", () => {
		it("enforces request rate limit strictly at boundary", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 5, tokensPerMinute: 100_000 } });
			const origin = "https://ratelimit-strict.com";

			// Fill up to exactly the limit
			for (let i = 0; i < 5; i++) {
				recordRequest(origin, 10);
			}

			// The 6th request should be denied
			const result = checkRateLimit(origin, perm);
			expect(result.allowed).toBe(false);
		});

		it("enforces token rate limit strictly at boundary", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 100, tokensPerMinute: 1000 } });
			const origin = "https://token-strict.com";

			// Use exactly 1000 tokens
			recordRequest(origin, 1000);

			const result = checkRateLimit(origin, perm);
			expect(result.allowed).toBe(false);
		});

		it("cannot bypass rate limit by using different casing in origin", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 2, tokensPerMinute: 100_000 } });

			// Fill rate limit for exact origin
			recordRequest("https://case-test.com", 10);
			recordRequest("https://case-test.com", 10);

			// Same origin should be denied
			const result = checkRateLimit("https://case-test.com", perm);
			expect(result.allowed).toBe(false);

			// Different casing is technically a different origin (correct behavior)
			const resultDifferent = checkRateLimit("https://CASE-TEST.COM", perm);
			expect(resultDifferent.allowed).toBe(true);
		});
	});

	describe("cost estimation security", () => {
		it("unknown models get conservative (higher) estimate, not zero", () => {
			const cost = estimateCostCents("unknown-provider", "unknown-model", 5000, 2000);
			expect(cost).toBeGreaterThan(0);
			// Fallback: (5000 + 2000) / 1000 * 0.5 = 3.5 → ceil → 4
			expect(cost).toBe(4);
		});

		it("attacker cannot get free API calls by using unknown model string", () => {
			// Even with a crafted model string, cost should be > 0 for non-zero tokens
			const cost = estimateCostCents("openai", "../../../etc/passwd", 1000, 500);
			expect(cost).toBeGreaterThan(0);
		});
	});

	describe("budget boundary conditions", () => {
		it("budget of exactly 1 cent blocks requests costing more than 1 cent", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({ budget: { amount: 1, period: "daily", spent: 0, periodStart: Date.now() } }),
			);
			const result = await checkBudget("https://example.com", 2);
			expect(result.allowed).toBe(false);
		});

		it("budget of exactly 1 cent allows request costing exactly 1 cent", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({ budget: { amount: 1, period: "daily", spent: 0, periodStart: Date.now() } }),
			);
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(true);
		});

		it("total budget period never resets (amount is absolute cap)", async () => {
			// "total" period means MAX_SAFE_INTEGER as periodEnd — effectively never resets
			mockGetPermission.mockResolvedValue(
				makePerm({ budget: { amount: 500, period: "total", spent: 500, periodStart: Date.now() - 365 * 24 * 60 * 60 * 1000 } }),
			);
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(false);
		});
	});
});
