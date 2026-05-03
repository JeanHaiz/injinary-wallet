import type { AppPermission } from "@injinary-wallet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkBudget,
	checkRateLimit,
	deductBudget,
	estimateCostCents,
	recordRequest,
} from "./budget.js";

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

// ─── Mock permissions module ────────────────────────────────────────────────
// budget.ts imports getPermission from permissions — we mock it here
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

describe("budget", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const key of Object.keys(storage)) delete storage[key];
	});

	describe("checkBudget", () => {
		it("allows request within budget", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({
					budget: { amount: 1000, period: "daily", spent: 200, periodStart: Date.now() },
				}),
			);
			const result = await checkBudget("https://example.com", 100);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(800);
		});

		it("denies request exceeding budget", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({
					budget: { amount: 1000, period: "daily", spent: 950, periodStart: Date.now() },
				}),
			);
			const result = await checkBudget("https://example.com", 100);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Budget exceeded");
			expect(result.remaining).toBe(50);
		});

		it("denies when budget is exactly exhausted", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({
					budget: { amount: 1000, period: "daily", spent: 1000, periodStart: Date.now() },
				}),
			);
			const result = await checkBudget("https://example.com", 1);
			expect(result.allowed).toBe(false);
		});

		it("allows request that exactly matches remaining budget", async () => {
			mockGetPermission.mockResolvedValue(
				makePerm({
					budget: { amount: 1000, period: "daily", spent: 900, periodStart: Date.now() },
				}),
			);
			const result = await checkBudget("https://example.com", 100);
			expect(result.allowed).toBe(true);
		});

		it("denies when no permission exists", async () => {
			mockGetPermission.mockResolvedValue(null);
			const result = await checkBudget("https://unknown.com", 10);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("No permission");
		});
	});

	describe("deductBudget", () => {
		it("deducts cost and persists to storage", async () => {
			const perm = makePerm();
			mockGetPermission.mockResolvedValue(perm);
			storage.app_permissions = { "https://example.com": perm };

			await deductBudget("https://example.com", 42);

			expect(perm.budget.spent).toBe(42);
			expect(chromeStorageMock.set).toHaveBeenCalledWith({
				app_permissions: expect.objectContaining({
					"https://example.com": expect.objectContaining({
						budget: expect.objectContaining({ spent: 42 }),
					}),
				}),
			});
		});

		it("accumulates multiple deductions", async () => {
			const perm = makePerm();
			mockGetPermission.mockResolvedValue(perm);
			storage.app_permissions = { "https://example.com": perm };

			await deductBudget("https://example.com", 10);
			await deductBudget("https://example.com", 20);
			await deductBudget("https://example.com", 30);

			expect(perm.budget.spent).toBe(60);
		});

		it("does nothing when permission not found", async () => {
			mockGetPermission.mockResolvedValue(null);
			await deductBudget("https://unknown.com", 100);
			expect(chromeStorageMock.set).not.toHaveBeenCalled();
		});
	});

	describe("checkRateLimit", () => {
		it("allows request within rate limit", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 5, tokensPerMinute: 1000 } });
			const result = checkRateLimit("https://example.com", perm);
			expect(result.allowed).toBe(true);
		});

		it("denies when request count exceeds limit", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 3, tokensPerMinute: 100_000 } });
			const origin = "https://rate-test.com";

			for (let i = 0; i < 3; i++) {
				recordRequest(origin, 10);
			}

			const result = checkRateLimit(origin, perm);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("too many requests");
		});

		it("denies when token count exceeds limit", () => {
			const perm = makePerm({ rateLimit: { requestsPerMinute: 100, tokensPerMinute: 500 } });
			const origin = "https://token-test.com";

			recordRequest(origin, 300);
			recordRequest(origin, 300);

			const result = checkRateLimit(origin, perm);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("too many tokens");
		});
	});

	describe("estimateCostCents", () => {
		it("estimates cost for known OpenAI model", () => {
			// gpt-4o: input=0.0025/1k, output=0.01/1k
			const cost = estimateCostCents("openai", "gpt-4o", 1000, 1000);
			// (1000/1000 * 0.0025 + 1000/1000 * 0.01) * 100 = 1.25 → ceil → 2
			expect(cost).toBe(2);
		});

		it("estimates cost for known Anthropic model", () => {
			// claude-opus: input=0.015/1k, output=0.075/1k
			const cost = estimateCostCents("anthropic", "claude-opus-4-20250514", 2000, 1000);
			// (2000/1000 * 0.015 + 1000/1000 * 0.075) * 100 = (0.03 + 0.075) * 100 = 10.5 → ceil → 11
			expect(cost).toBe(11);
		});

		it("uses conservative fallback for unknown models", () => {
			const cost = estimateCostCents("unknown", "mystery-model", 1000, 1000);
			// (1000 + 1000) / 1000 * 0.5 = 1 → ceil → 1
			expect(cost).toBe(1);
		});

		it("handles zero tokens", () => {
			const cost = estimateCostCents("openai", "gpt-4o", 0, 0);
			expect(cost).toBe(0);
		});

		it("handles large token counts", () => {
			const cost = estimateCostCents("openai", "gpt-4-turbo", 100_000, 50_000);
			// input: 100k/1k * 0.01 = 1.0, output: 50k/1k * 0.03 = 1.5
			// (1.0 + 1.5) * 100 = 250
			expect(cost).toBe(250);
		});
	});
});
