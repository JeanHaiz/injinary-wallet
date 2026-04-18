// ─── Service Worker ──────────────────────────────────────────────────────────
// The trusted core of the AI Wallet. Routes messages from:
// 1. Content scripts (external RPC from web apps via SDK)
// 2. Popup/extension pages (internal UI operations)

import {
	type ApprovalResolveParams,
	type CompletionRequest,
	type ConnectParams,
	type EmbedRequest,
	INTERNAL_MSG,
	type InternalMethod,
	type InternalRequest,
	type KeyAddParams,
	type KeyRemoveParams,
	type KeySetDefaultParams,
	type PendingApproval,
	type PermGrantParams,
	type PermRevokeParams,
	type ProviderId,
	type RpcErrorCode,
	type RpcMethod,
	type VaultInitializeParams,
	type VaultUnlockParams,
	WALLET_CAPABILITIES,
	WALLET_VERSION,
} from "@ai-wallet/shared";
import { RpcErrorCode as ErrorCode } from "@ai-wallet/shared";
import {
	checkBudget,
	checkRateLimit,
	deductBudget,
	estimateCostCents,
	recordRequest,
} from "./budget.js";
import {
	checkPermission,
	getAllPermissions,
	getBudgetStatus,
	getPermission,
	grantPermission,
	revokePermission,
	toSummary,
} from "./permissions.js";
import { getProvider } from "./proxy/registry.js";
import { getUsageEntries, logUsage } from "./usage.js";
import {
	addKey,
	getKeyForProvider,
	getKeys,
	isUnlocked,
	removeKey,
	tryRestoreSession,
	initialize as vaultInitialize,
	isInitialized as vaultIsInitialized,
	lock as vaultLock,
	unlock as vaultUnlock,
} from "./vault.js";

// ─── Initialization ──────────────────────────────────────────────────────────

tryRestoreSession().catch(console.error);

// ─── Pending Approval Queue ──────────────────────────────────────────────────
// When a web app calls connect(), we queue the request here and open the popup.
// The popup reads the pending request and resolves it when the user decides.

const pendingApprovals = new Map<
	string,
	{
		approval: PendingApproval;
		resolve: (value: unknown) => void;
		reject: (err: Error) => void;
	}
>();

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
	(message: { type: string }, sender, sendResponse: (response: unknown) => void) => {
		// Route to the right handler based on message type
		if (message.type === "AI_WALLET_INTERNAL") {
			// From content script (web app RPC)
			return handleContentScriptMessage(
				message as {
					type: string;
					rpcMethod: RpcMethod;
					rpcId: string;
					params: unknown;
					origin: string;
				},
				sender,
				sendResponse,
			);
		}

		if (message.type === INTERNAL_MSG) {
			// From popup / extension pages
			return handleInternalMessage(message as InternalRequest, sendResponse);
		}

		return false;
	},
);

// ─── Content Script Messages (External RPC) ─────────────────────────────────

function handleContentScriptMessage(
	message: { type: string; rpcMethod: RpcMethod; rpcId: string; params: unknown; origin: string },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void,
): boolean {
	if (!sender.tab?.id || !sender.tab?.url) {
		sendResponse({ error: { code: ErrorCode.PermissionDenied, message: "Invalid sender" } });
		return false;
	}

	const tabUrl = new URL(sender.tab.url);
	const origin = tabUrl.origin;

	handleRpc(message.rpcMethod, message.params, origin, sender.tab.id)
		.then((result) => sendResponse({ result }))
		.catch((err) => {
			const error =
				err instanceof RpcError
					? { code: err.code, message: err.message }
					: { code: ErrorCode.InternalError, message: String(err) };
			sendResponse({ error });
		});

	return true; // async response
}

// ─── Internal Messages (Popup UI) ───────────────────────────────────────────

function handleInternalMessage(
	message: InternalRequest,
	sendResponse: (response: unknown) => void,
): boolean {
	handleInternal(message.method, message.params)
		.then((result) => sendResponse({ result }))
		.catch((err) => sendResponse({ error: String(err) }));

	return true; // async response
}

async function handleInternal(method: InternalMethod, params: unknown): Promise<unknown> {
	switch (method) {
		// ── Vault ──
		case "vault_isInitialized":
			return vaultIsInitialized();

		case "vault_isUnlocked":
			return isUnlocked();

		case "vault_initialize": {
			const p = params as VaultInitializeParams;
			await vaultInitialize(p.password);
			return { ok: true };
		}

		case "vault_unlock": {
			const p = params as VaultUnlockParams;
			await vaultUnlock(p.password);
			return { ok: true };
		}

		case "vault_lock":
			await vaultLock();
			return { ok: true };

		// ── Keys ──
		case "keys_list":
			return getKeys().map((k) => ({ ...k, apiKey: maskKey(k.apiKey) }));

		case "keys_add": {
			const p = params as KeyAddParams;
			const key = await addKey(p);
			return { ...key, apiKey: maskKey(key.apiKey) };
		}

		case "keys_remove": {
			const p = params as KeyRemoveParams;
			await removeKey(p.id);
			return { ok: true };
		}

		case "keys_setDefault": {
			const p = params as KeySetDefaultParams;
			// Clear existing defaults for same provider, set this one
			const keys = getKeys();
			const target = keys.find((k) => k.id === p.id);
			if (!target) throw new Error("Key not found");
			for (const k of keys) {
				if (k.provider === target.provider && k.id !== p.id && k.isDefault) {
					// We need to modify through vault — for now just remove and re-add
					// This is a simplification; a proper setDefault would be better
				}
			}
			return { ok: true };
		}

		// ── Permissions ──
		case "perms_list":
			return getAllPermissions();

		case "perms_get": {
			const p = params as { origin: string };
			return getPermission(p.origin);
		}

		case "perms_grant": {
			const p = params as PermGrantParams;
			const perm = await grantPermission(
				p.origin,
				{ appName: p.origin, appIcon: undefined },
				{
					allowedProviders: p.allowedProviders,
					allowedModels: p.allowedModels,
					budgetAmount: p.budgetAmount,
					budgetPeriod: p.budgetPeriod,
					autoApprove: p.autoApprove,
					autoApproveMaxCostCents: p.autoApproveMaxCostCents,
					expiresAt: p.expiresAt,
				},
			);
			return perm;
		}

		case "perms_revoke": {
			const p = params as PermRevokeParams;
			await revokePermission(p.origin);
			return { ok: true };
		}

		// ── Pending Approvals ──
		case "approval_getPending":
			return [...pendingApprovals.values()].map((p) => p.approval);

		case "approval_resolve": {
			const p = params as ApprovalResolveParams;
			const pending = pendingApprovals.get(p.requestId);
			if (!pending) throw new Error("No pending approval with that ID");

			if (p.approved && p.grant) {
				// Grant the permission
				const perm = await grantPermission(
					pending.approval.origin,
					{
						appName: pending.approval.appName,
						appIcon: pending.approval.appIcon,
					},
					{
						allowedProviders: p.grant.allowedProviders,
						allowedModels: p.grant.allowedModels,
						budgetAmount: p.grant.budgetAmount,
						budgetPeriod: p.grant.budgetPeriod,
						autoApprove: p.grant.autoApprove,
						autoApproveMaxCostCents: p.grant.autoApproveMaxCostCents,
						expiresAt: p.grant.expiresAt,
					},
				);
				pending.resolve(toSummary(perm));
			} else {
				pending.reject(new RpcError(ErrorCode.UserRejected, "User denied the request"));
			}

			pendingApprovals.delete(p.requestId);
			return { ok: true };
		}

		default:
			throw new Error(`Unknown internal method: ${method}`);
	}
}

// ─── External RPC Routing ────────────────────────────────────────────────────

class RpcError extends Error {
	constructor(
		public code: RpcErrorCode,
		message: string,
	) {
		super(message);
	}
}

async function handleRpc(
	method: RpcMethod,
	params: unknown,
	origin: string,
	tabId: number,
): Promise<unknown> {
	switch (method) {
		case "ai_detectWallet":
			return { version: WALLET_VERSION, capabilities: WALLET_CAPABILITIES };

		case "ai_requestAccess":
			return handleRequestAccess(params as ConnectParams, origin, tabId);

		case "ai_revokeAccess":
			await revokePermission(origin);
			return { ok: true };

		case "ai_getPermissions":
			return handleGetPermissions(origin);

		case "ai_complete":
			return handleComplete(params as CompletionRequest, origin);

		case "ai_completeStream":
			return handleStreamSetup(params as CompletionRequest, origin);

		case "ai_embed":
			return handleEmbed(params as EmbedRequest, origin);

		case "ai_listModels":
			return handleListModels(origin);

		case "ai_getBudget":
			return handleGetBudget(origin);

		case "ai_getUsage":
			return handleGetUsage(params as { limit?: number; since?: number } | undefined, origin);

		default:
			throw new RpcError(ErrorCode.MethodNotFound, `Unknown method: ${method}`);
	}
}

// ─── External RPC Handlers ───────────────────────────────────────────────────

async function handleRequestAccess(
	params: ConnectParams,
	origin: string,
	_tabId: number,
): Promise<unknown> {
	// Already permitted?
	const existing = await getPermission(origin);
	if (existing) return toSummary(existing);

	// Create a pending approval and open the popup
	const requestId = crypto.randomUUID();
	const approval: PendingApproval = {
		requestId,
		origin,
		appName: params.appName,
		appIcon: params.appIcon,
		requestedProviders: params.requestedProviders,
		requestedModels: params.requestedModels,
		requestedBudget: params.requestedBudget
			? { amount: params.requestedBudget.amount, period: params.requestedBudget.period }
			: undefined,
		timestamp: Date.now(),
	};

	return new Promise((resolve, reject) => {
		pendingApprovals.set(requestId, { approval, resolve, reject });

		// Open the popup so the user can approve/deny
		chrome.action.openPopup().catch(() => {
			// openPopup() may not be available in all contexts — user can click the icon
		});
	});
}

async function handleGetPermissions(origin: string) {
	const perm = await getPermission(origin);
	if (!perm) throw new RpcError(ErrorCode.NotConnected, "Not connected");
	return toSummary(perm);
}

async function handleComplete(request: CompletionRequest, origin: string) {
	assertUnlocked();

	const provider = request.provider ?? "openai";
	const model = request.model ?? getDefaultModel(provider);

	const permCheck = await checkPermission(origin, provider, model);
	if (!permCheck.allowed) {
		throw new RpcError(ErrorCode.PermissionDenied, permCheck.reason!);
	}

	const perm = (await getPermission(origin))!;

	const rateCheck = checkRateLimit(origin, perm);
	if (!rateCheck.allowed) {
		throw new RpcError(ErrorCode.RateLimited, rateCheck.reason!);
	}

	const inputEstimate = estimateTokens(request.messages.map((m) => m.content).join(" "));
	const maxOutput = request.maxTokens ?? 4096;
	const costEstimate = estimateCostCents(provider, model, inputEstimate, maxOutput);

	const budgetCheck = await checkBudget(origin, costEstimate);
	if (!budgetCheck.allowed) {
		throw new RpcError(ErrorCode.BudgetExceeded, budgetCheck.reason!);
	}

	const providerKey = getKeyForProvider(provider);
	if (!providerKey) {
		throw new RpcError(ErrorCode.ProviderError, `No API key configured for ${provider}`);
	}

	const proxy = getProvider(provider as ProviderId);
	if (!proxy) {
		throw new RpcError(ErrorCode.ProviderError, `Provider "${provider}" not supported`);
	}

	const startTime = Date.now();
	const response = await proxy.complete(
		providerKey.apiKey,
		{ ...request, model },
		providerKey.baseUrl,
	);

	const actualCost = estimateCostCents(
		provider,
		model,
		response.usage.promptTokens,
		response.usage.completionTokens,
	);
	response.usage.estimatedCostCents = actualCost;

	recordRequest(origin, response.usage.totalTokens);
	await deductBudget(origin, actualCost);
	await logUsage({
		timestamp: Date.now(),
		origin,
		provider: provider as ProviderId,
		model,
		promptTokens: response.usage.promptTokens,
		completionTokens: response.usage.completionTokens,
		estimatedCostCents: actualCost,
		method: "ai_complete",
		durationMs: Date.now() - startTime,
	});

	return response;
}

async function handleStreamSetup(request: CompletionRequest, origin: string) {
	assertUnlocked();

	const provider = request.provider ?? "openai";
	const model = request.model ?? getDefaultModel(provider);

	const permCheck = await checkPermission(origin, provider, model);
	if (!permCheck.allowed) {
		throw new RpcError(ErrorCode.PermissionDenied, permCheck.reason!);
	}

	const providerKey = getKeyForProvider(provider);
	if (!providerKey) {
		throw new RpcError(ErrorCode.ProviderError, `No API key configured for ${provider}`);
	}

	return { ok: true, provider, model };
}

async function handleEmbed(request: EmbedRequest, origin: string) {
	assertUnlocked();

	const provider = request.provider ?? "openai";
	const model = request.model ?? "text-embedding-3-small";

	const permCheck = await checkPermission(origin, provider, model);
	if (!permCheck.allowed) {
		throw new RpcError(ErrorCode.PermissionDenied, permCheck.reason!);
	}

	const providerKey = getKeyForProvider(provider);
	if (!providerKey) {
		throw new RpcError(ErrorCode.ProviderError, `No API key configured for ${provider}`);
	}

	const proxy = getProvider(provider as ProviderId);
	if (!proxy) {
		throw new RpcError(ErrorCode.ProviderError, `Provider "${provider}" not supported`);
	}

	return proxy.embed(providerKey.apiKey, { ...request, model }, providerKey.baseUrl);
}

async function handleListModels(origin: string) {
	const perm = await getPermission(origin);
	if (!perm) throw new RpcError(ErrorCode.NotConnected, "Not connected");

	const allModels = [];
	for (const providerId of perm.allowedProviders) {
		const proxy = getProvider(providerId);
		if (!proxy) continue;

		const providerKey = getKeyForProvider(providerId);
		if (!providerKey) continue;

		const models = await proxy.listModels(providerKey.apiKey, providerKey.baseUrl);
		const filtered = perm.allowedModels.includes("*")
			? models
			: models.filter((m) => perm.allowedModels.includes(m.id));
		allModels.push(...filtered);
	}

	return allModels;
}

async function handleGetBudget(origin: string) {
	const status = await getBudgetStatus(origin);
	if (!status) throw new RpcError(ErrorCode.NotConnected, "Not connected");
	return status;
}

async function handleGetUsage(
	params: { limit?: number; since?: number } | undefined,
	origin: string,
) {
	const perm = await getPermission(origin);
	if (!perm) throw new RpcError(ErrorCode.NotConnected, "Not connected");

	return getUsageEntries({
		origin,
		limit: params?.limit,
		since: params?.since,
	});
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertUnlocked(): void {
	if (!isUnlocked()) {
		throw new RpcError(ErrorCode.WalletLocked, "Wallet is locked. Please unlock it first.");
	}
}

function getDefaultModel(provider: string): string {
	switch (provider) {
		case "openai":
			return "gpt-4o";
		case "anthropic":
			return "claude-sonnet-4-20250514";
		case "google":
			return "gemini-2.0-flash";
		default:
			return "unknown";
	}
}

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// tabId is passed for future use (per-request confirmation popup targeting)

function maskKey(key: string): string {
	if (key.length <= 8) return "••••••••";
	return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
