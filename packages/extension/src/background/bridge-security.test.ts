import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	INJINARY_WALLET_RPC,
	INJINARY_WALLET_RPC_RESPONSE,
	type RpcMethod,
} from "@injinary-wallet/shared";

// ─── Simulate minimal browser globals needed by bridge.ts ────────────────────
const mockSendMessage = vi.fn();
const messageListeners: ((event: unknown) => void)[] = [];
const postMessageCalls: unknown[] = [];

vi.stubGlobal("chrome", {
	runtime: { sendMessage: mockSendMessage },
});

vi.stubGlobal("window", {
	addEventListener: (type: string, handler: (event: unknown) => void) => {
		if (type === "message") messageListeners.push(handler);
	},
	postMessage: (data: unknown, _target: string) => {
		postMessageCalls.push(data);
	},
	location: { origin: "http://localhost" },
});

// ─── Load bridge module (registers handler via addEventListener) ─────────────
await import("../content/bridge.js");

// The bridge registers exactly one message handler
function dispatchMessage(data: unknown, source: unknown = globalThis.window) {
	for (const handler of messageListeners) {
		handler({ data, source } as unknown);
	}
}

function makeRpcData(overrides: Record<string, unknown> = {}) {
	return {
		type: INJINARY_WALLET_RPC,
		id: "test-id-123",
		method: "ai_detectWallet" as string,
		params: {},
		...overrides,
	};
}

describe("bridge security", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		postMessageCalls.length = 0;
		// Default: return a resolved promise so any message that leaks through
		// doesn't crash with ".then is not a function"
		mockSendMessage.mockResolvedValue({ result: null });
	});

	describe("message validation", () => {
		it("rejects messages not from same window", () => {
			dispatchMessage(makeRpcData(), null);
			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("rejects messages with wrong type", () => {
			dispatchMessage(makeRpcData({ type: "WRONG_TYPE" }));
			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("rejects messages with no type field at all", () => {
			dispatchMessage({ id: "x", method: "ai_detectWallet", params: {} });
			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("rejects messages with non-string id", () => {
			dispatchMessage(makeRpcData({ id: 123 }));
			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("rejects messages with missing id", () => {
			dispatchMessage(makeRpcData({ id: undefined }));
			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("accepts valid RPC message and forwards to service worker", () => {
			mockSendMessage.mockResolvedValue({ result: { version: "1.0" } });
			dispatchMessage(makeRpcData());
			expect(mockSendMessage).toHaveBeenCalledOnce();
		});
	});

	describe("method whitelist — page script cannot call arbitrary methods", () => {
		const validMethods: RpcMethod[] = [
			"ai_detectWallet",
			"ai_requestAccess",
			"ai_revokeAccess",
			"ai_getPermissions",
			"ai_complete",
			"ai_completeStream",
			"ai_embed",
			"ai_listModels",
			"ai_getBudget",
			"ai_getUsage",
		];

		for (const method of validMethods) {
			it(`allows valid method: ${method}`, () => {
				mockSendMessage.mockResolvedValue({ result: {} });
				dispatchMessage(makeRpcData({ method }));
				expect(mockSendMessage).toHaveBeenCalledOnce();
			});
		}

		const invalidMethods = [
			"vault_unlock",
			"vault_initialize",
			"vault_lock",
			"keys_list",
			"keys_add",
			"keys_remove",
			"perms_grant",
			"perms_revoke",
			"approval_resolve",
			"eval",
			"__proto__",
			"constructor",
			"",
			"ai_",
			"ai_hackWallet",
		];

		for (const method of invalidMethods) {
			it(`blocks invalid/internal method: ${method}`, () => {
				dispatchMessage(makeRpcData({ method }));
				expect(mockSendMessage).not.toHaveBeenCalled();
			});
		}
	});

	describe("origin passing — page script cannot forge origin", () => {
		it("bridge sends window.location.origin, not user-supplied origin", () => {
			mockSendMessage.mockResolvedValue({ result: {} });

			dispatchMessage(
				makeRpcData({
					params: { origin: "https://evil.com", spoofedOrigin: "https://evil.com" },
				}),
			);

			expect(mockSendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					origin: "http://localhost", // Real origin from window.location
				}),
			);
		});

		it("user-supplied origin in params does not override the real origin", () => {
			mockSendMessage.mockResolvedValue({ result: {} });

			dispatchMessage(makeRpcData({ params: { origin: "https://attacker.com" } }));

			const sentMessage = mockSendMessage.mock.calls[0][0];
			expect(sentMessage.origin).toBe("http://localhost");
			// params are passed through but origin field is set by bridge, not page
			expect(sentMessage.params).toEqual({ origin: "https://attacker.com" });
		});
	});

	describe("response routing", () => {
		it("sends RPC response back via postMessage with correct shape", async () => {
			mockSendMessage.mockResolvedValue({ result: { version: "1.0.0" } });

			dispatchMessage(makeRpcData({ id: "resp-test" }));

			// Wait for async resolution of chrome.runtime.sendMessage
			await vi.waitFor(() => {
				expect(postMessageCalls.length).toBeGreaterThan(0);
			});

			expect(postMessageCalls[0]).toEqual({
				type: INJINARY_WALLET_RPC_RESPONSE,
				id: "resp-test",
				result: { version: "1.0.0" },
				error: undefined,
			});
		});

		it("sends error response when extension is not available", async () => {
			mockSendMessage.mockRejectedValue(new Error("Extension context invalidated"));

			dispatchMessage(makeRpcData({ id: "error-test" }));

			await vi.waitFor(() => {
				expect(postMessageCalls.length).toBeGreaterThan(0);
			});

			expect(postMessageCalls[0]).toEqual({
				type: INJINARY_WALLET_RPC_RESPONSE,
				id: "error-test",
				error: {
					code: -32603,
					message: "Injinary Wallet extension not available",
				},
			});
		});
	});

	describe("chrome.storage isolation — page script cannot access storage", () => {
		it("internal methods that access storage are blocked by the whitelist", () => {
			const internalMethods = ["vault_unlock", "keys_list", "keys_add", "perms_grant"];
			for (const method of internalMethods) {
				dispatchMessage(makeRpcData({ method }));
			}
			expect(mockSendMessage).not.toHaveBeenCalled();
		});
	});
});
