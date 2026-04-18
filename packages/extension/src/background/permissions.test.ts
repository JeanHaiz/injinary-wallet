import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Import after mocking chrome
import {
	checkPermission,
	getAllPermissions,
	getBudgetStatus,
	getPermission,
	grantPermission,
	revokePermission,
	toSummary,
} from "./permissions.js";
import type { AppPermission, ConnectParams } from "@injinary-wallet/shared";

const TEST_ORIGIN = "https://test-app.com";

const defaultConnectParams: ConnectParams = {
	appName: "Test App",
	requestedProviders: ["openai"],
	requestedBudget: { amount: 500, period: "daily" },
};

const defaultUserChoices = {
	allowedProviders: ["openai"] as AppPermission["allowedProviders"],
	allowedModels: ["*"],
	budgetAmount: 500,
	budgetPeriod: "daily" as const,
	autoApprove: true,
	autoApproveMaxCostCents: 50,
	expiresAt: null,
};

describe("permissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const key of Object.keys(storage)) delete storage[key];
		// Reset the module's internal loaded flag by re-clearing storage
		// The module caches, but we can work around by ensuring storage is clean
	});

	describe("grantPermission / getPermission", () => {
		it("grants and retrieves a permission", async () => {
			const perm = await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			expect(perm.origin).toBe(TEST_ORIGIN);
			expect(perm.allowedProviders).toEqual(["openai"]);
			expect(perm.budget.amount).toBe(500);
			expect(perm.budget.spent).toBe(0);

			const retrieved = await getPermission(TEST_ORIGIN);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.origin).toBe(TEST_ORIGIN);
		});

		it("returns null for unknown origin", async () => {
			const perm = await getPermission("https://unknown.com");
			expect(perm).toBeNull();
		});

		it("persists to chrome.storage", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			expect(chromeStorageMock.set).toHaveBeenCalledWith(
				expect.objectContaining({
					app_permissions: expect.any(Object),
				}),
			);
		});
	});

	describe("revokePermission", () => {
		it("removes a granted permission", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			await revokePermission(TEST_ORIGIN);
			const perm = await getPermission(TEST_ORIGIN);
			expect(perm).toBeNull();
		});

		it("is a no-op for unknown origins", async () => {
			await revokePermission("https://never-granted.com");
			// Should not throw
		});
	});

	describe("checkPermission", () => {
		it("allows request for permitted provider and wildcard model", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			const result = await checkPermission(TEST_ORIGIN, "openai", "gpt-4o");
			expect(result.allowed).toBe(true);
		});

		it("denies request for non-permitted provider", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			const result = await checkPermission(TEST_ORIGIN, "anthropic", "claude-sonnet-4-20250514");
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Provider");
			expect(result.reason).toContain("not allowed");
		});

		it("denies request for non-permitted model when not using wildcard", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				allowedModels: ["gpt-4o"],
			});
			const result = await checkPermission(TEST_ORIGIN, "openai", "gpt-4-turbo");
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Model");
			expect(result.reason).toContain("not allowed");
		});

		it("allows specific model when explicitly listed", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				allowedModels: ["gpt-4o", "gpt-4o-mini"],
			});
			const result = await checkPermission(TEST_ORIGIN, "openai", "gpt-4o-mini");
			expect(result.allowed).toBe(true);
		});

		it("denies request for origin with no permission", async () => {
			const result = await checkPermission("https://no-perm.com", "openai", "gpt-4o");
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("No permission");
		});
	});

	describe("expired permissions", () => {
		it("returns null for expired permission", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				expiresAt: Date.now() - 1000, // expired 1 second ago
			});
			const perm = await getPermission(TEST_ORIGIN);
			expect(perm).toBeNull();
		});

		it("denies check for expired permission", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				expiresAt: Date.now() - 1000,
			});
			const result = await checkPermission(TEST_ORIGIN, "openai", "gpt-4o");
			expect(result.allowed).toBe(false);
		});

		it("allows non-expired permission", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				expiresAt: Date.now() + 60_000, // expires in 1 minute
			});
			const perm = await getPermission(TEST_ORIGIN);
			expect(perm).not.toBeNull();
		});
	});

	describe("toSummary", () => {
		it("converts permission to public summary without internals", async () => {
			const perm = await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			const summary = toSummary(perm);
			expect(summary.origin).toBe(TEST_ORIGIN);
			expect(summary.allowedProviders).toEqual(["openai"]);
			expect(summary.budgetRemaining).toBe(500);
			expect(summary.budgetLimit).toBe(500);
			expect(summary.budgetPeriod).toBe("daily");
			expect(summary.autoApprove).toBe(true);
			// Ensure internal fields are not exposed
			expect(summary).not.toHaveProperty("grantedAt");
			expect(summary).not.toHaveProperty("expiresAt");
			expect(summary).not.toHaveProperty("rateLimit");
			expect(summary).not.toHaveProperty("budget");
		});

		it("calculates remaining correctly when partially spent", () => {
			const perm: AppPermission = {
				origin: TEST_ORIGIN,
				grantedAt: Date.now(),
				expiresAt: null,
				allowedProviders: ["openai"],
				allowedModels: ["*"],
				budget: { amount: 1000, period: "daily", spent: 750, periodStart: Date.now() },
				rateLimit: { requestsPerMinute: 20, tokensPerMinute: 100_000 },
				autoApprove: true,
				autoApproveMaxCostCents: 50,
			};
			const summary = toSummary(perm);
			expect(summary.budgetRemaining).toBe(250);
		});

		it("clamps remaining to zero when overspent", () => {
			const perm: AppPermission = {
				origin: TEST_ORIGIN,
				grantedAt: Date.now(),
				expiresAt: null,
				allowedProviders: ["openai"],
				allowedModels: ["*"],
				budget: { amount: 100, period: "daily", spent: 150, periodStart: Date.now() },
				rateLimit: { requestsPerMinute: 20, tokensPerMinute: 100_000 },
				autoApprove: true,
				autoApproveMaxCostCents: 50,
			};
			const summary = toSummary(perm);
			expect(summary.budgetRemaining).toBe(0);
		});
	});

	describe("getBudgetStatus", () => {
		it("returns budget status for a permitted origin", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, defaultUserChoices);
			const status = await getBudgetStatus(TEST_ORIGIN);
			expect(status).not.toBeNull();
			expect(status!.limit).toBe(500);
			expect(status!.spent).toBe(0);
			expect(status!.remaining).toBe(500);
			expect(status!.period).toBe("daily");
		});

		it("returns null for unknown origin", async () => {
			const status = await getBudgetStatus("https://unknown.com");
			expect(status).toBeNull();
		});
	});

	describe("getAllPermissions", () => {
		it("returns all granted permissions", async () => {
			// Revoke any leftover permissions from prior tests (module caches in-memory)
			const before = await getAllPermissions();
			for (const p of before) {
				await revokePermission(p.origin);
			}

			await grantPermission("https://app-a.com", defaultConnectParams, defaultUserChoices);
			await grantPermission("https://app-b.com", defaultConnectParams, defaultUserChoices);
			const all = await getAllPermissions();
			expect(all.length).toBe(2);
			const origins = all.map((p) => p.origin);
			expect(origins).toContain("https://app-a.com");
			expect(origins).toContain("https://app-b.com");
		});
	});

	describe("budget period reset", () => {
		it("resets spent amount when daily period has elapsed", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				budgetPeriod: "daily",
			});

			// Manually set the periodStart to 2 days ago and spent to 400
			const perm = await getPermission(TEST_ORIGIN);
			perm!.budget.periodStart = Date.now() - 2 * 24 * 60 * 60 * 1000;
			perm!.budget.spent = 400;

			const status = await getBudgetStatus(TEST_ORIGIN);
			expect(status!.spent).toBe(0); // should have been reset
			expect(status!.remaining).toBe(500);
		});
	});

	describe("multiple providers", () => {
		it("allows multiple providers when granted", async () => {
			await grantPermission(TEST_ORIGIN, defaultConnectParams, {
				...defaultUserChoices,
				allowedProviders: ["openai", "anthropic"],
			});
			const r1 = await checkPermission(TEST_ORIGIN, "openai", "gpt-4o");
			const r2 = await checkPermission(TEST_ORIGIN, "anthropic", "claude-sonnet-4-20250514");
			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);
		});
	});
});
