// ─── Usage Tracking ──────────────────────────────────────────────────────────
// Logs all AI requests for analytics and auditing. Ring buffer + daily aggregates.

import type { DailyAggregate, UsageEntry } from "@ai-wallet/shared";
import { MAX_DAILY_AGGREGATES, MAX_USAGE_LOG_ENTRIES } from "@ai-wallet/shared";

const STORAGE_KEYS = {
	entries: "usage_entries",
	aggregates: "usage_aggregates",
} as const;

/** Log a completed request */
export async function logUsage(entry: Omit<UsageEntry, "id">): Promise<void> {
	const fullEntry: UsageEntry = {
		...entry,
		id: crypto.randomUUID(),
	};

	// Append to ring buffer
	const result = await chrome.storage.local.get(STORAGE_KEYS.entries);
	const entries = (result[STORAGE_KEYS.entries] as UsageEntry[]) ?? [];
	entries.push(fullEntry);

	// Prune if over limit
	if (entries.length > MAX_USAGE_LOG_ENTRIES) {
		entries.splice(0, entries.length - MAX_USAGE_LOG_ENTRIES);
	}

	await chrome.storage.local.set({ [STORAGE_KEYS.entries]: entries });

	// Update daily aggregate
	await updateDailyAggregate(fullEntry);
}

/** Get recent usage entries */
export async function getUsageEntries(options?: {
	limit?: number;
	since?: number;
	origin?: string;
}): Promise<UsageEntry[]> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.entries);
	let entries = (result[STORAGE_KEYS.entries] as UsageEntry[]) ?? [];

	if (options?.since) {
		entries = entries.filter((e) => e.timestamp >= options.since!);
	}
	if (options?.origin) {
		entries = entries.filter((e) => e.origin === options.origin);
	}
	if (options?.limit) {
		entries = entries.slice(-options.limit);
	}

	return entries;
}

/** Get daily aggregates for analytics */
export async function getDailyAggregates(): Promise<DailyAggregate[]> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.aggregates);
	return (result[STORAGE_KEYS.aggregates] as DailyAggregate[]) ?? [];
}

// ─── Private ─────────────────────────────────────────────────────────────────

async function updateDailyAggregate(entry: UsageEntry): Promise<void> {
	const date = new Date(entry.timestamp).toISOString().slice(0, 10);

	const result = await chrome.storage.local.get(STORAGE_KEYS.aggregates);
	const aggregates = (result[STORAGE_KEYS.aggregates] as DailyAggregate[]) ?? [];

	let today = aggregates.find((a) => a.date === date);
	if (!today) {
		today = { date, byOrigin: {}, byProvider: {} };
		aggregates.push(today);
	}

	// Update by origin
	const originStats = today.byOrigin[entry.origin] ?? { requests: 0, totalTokens: 0, costCents: 0 };
	originStats.requests++;
	originStats.totalTokens += entry.promptTokens + entry.completionTokens;
	originStats.costCents += entry.estimatedCostCents;
	today.byOrigin[entry.origin] = originStats;

	// Update by provider
	const providerStats = today.byProvider[entry.provider] ?? {
		requests: 0,
		totalTokens: 0,
		costCents: 0,
	};
	providerStats.requests++;
	providerStats.totalTokens += entry.promptTokens + entry.completionTokens;
	providerStats.costCents += entry.estimatedCostCents;
	today.byProvider[entry.provider] = providerStats;

	// Prune old aggregates
	if (aggregates.length > MAX_DAILY_AGGREGATES) {
		aggregates.splice(0, aggregates.length - MAX_DAILY_AGGREGATES);
	}

	await chrome.storage.local.set({ [STORAGE_KEYS.aggregates]: aggregates });
}
