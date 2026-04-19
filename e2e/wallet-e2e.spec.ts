// E2E test: load extension → set password → add key → visit test app →
// connect → make AI call → verify budget updated

import path from "node:path";
import { expect, test } from "./fixtures";

const TEST_PASSWORD = "test-password-123";
const FAKE_API_KEY = "sk-test-fake-key-for-e2e-testing";
const TEST_APP_PATH = path.resolve(__dirname, "../packages/test-app/index.html");

// Mock OpenAI API response
const MOCK_COMPLETION_RESPONSE = {
	id: "chatcmpl-e2e-test",
	object: "chat.completion",
	model: "gpt-4o-2024-08-06",
	choices: [
		{
			index: 0,
			message: { role: "assistant", content: "Hello! How can I help you today?" },
			finish_reason: "stop",
		},
	],
	usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
};

test("full wallet flow: setup → add key → connect app → AI call → budget updated", async ({
	context,
	extensionId,
}) => {
	// ─── Step 1: Set up the vault (create password) ────────────────────────────
	const popup = await context.newPage();
	await popup.goto(`chrome-extension://${extensionId}/popup.html`);

	// Should show the setup screen
	await expect(popup.locator("#pw1")).toBeVisible({ timeout: 5000 });

	// Enter password and create wallet
	await popup.fill("#pw1", TEST_PASSWORD);
	await popup.fill("#pw2", TEST_PASSWORD);
	await popup.click("#setup-btn");

	// Should navigate to dashboard after setup
	await expect(popup.locator("#lock-btn")).toBeVisible({ timeout: 5000 });

	// ─── Step 2: Add an API key ────────────────────────────────────────────────
	// Navigate to keys tab
	await popup.click('button[data-tab="keys"]');
	await expect(popup.locator("#show-form-btn")).toBeVisible({ timeout: 3000 });

	// Open the add key form
	await popup.click("#show-form-btn");
	await expect(popup.locator("#add-key-form")).toBeVisible({ timeout: 3000 });

	// Fill in the key form — select OpenAI provider, enter key
	await popup.selectOption("#key-provider", "openai");
	await popup.fill("#key-label", "E2E Test Key");
	await popup.fill("#key-value", FAKE_API_KEY);
	// Default checkbox should already be checked

	await popup.click("#add-key-btn");

	// Verify key appears in the list
	await expect(popup.locator(".key-card")).toBeVisible({ timeout: 3000 });
	await expect(popup.locator(".key-card")).toContainText("E2E Test Key");

	// ─── Step 3: Open test app and detect wallet ───────────────────────────────
	const testApp = await context.newPage();
	await testApp.goto(`file://${TEST_APP_PATH}`);

	// Wait for wallet detection (auto-runs on load)
	await expect(testApp.locator("#detect-status .dot.green")).toBeVisible({ timeout: 5000 });
	await expect(testApp.locator("#btn-connect")).toBeEnabled({ timeout: 3000 });

	// ─── Step 4: Connect to wallet (triggers approval flow) ────────────────────
	// Click connect — this triggers ai_requestAccess which creates a pending approval
	// Don't await — the connect promise won't resolve until we approve in the popup
	testApp.click("#btn-connect");

	// Wait for the test app to confirm the RPC was sent (button text changes)
	await expect(testApp.locator("#btn-connect")).toContainText("Waiting", { timeout: 5000 });

	// Now navigate the popup — the pending approval should exist
	// Use polling: the service worker may take a moment to register the approval
	await expect(async () => {
		await popup.goto(`chrome-extension://${extensionId}/popup.html`);
		await expect(popup.locator("#approve-btn")).toBeVisible({ timeout: 3000 });
	}).toPass({ timeout: 15000 });

	// Verify approval screen shows correct info
	await expect(popup.locator(".approval-origin")).toBeVisible();

	// Make sure OpenAI provider is checked
	const openaiCheckbox = popup.locator("#prov-openai");
	if (!(await openaiCheckbox.isChecked())) {
		await openaiCheckbox.check();
	}

	// Set budget
	await popup.fill("#budget-amount", "500");

	// Approve the connection
	await popup.click("#approve-btn");

	// Wait for the test app to show connected status
	await expect(testApp.locator("#connect-status .dot.green")).toBeVisible({ timeout: 10000 });
	await expect(testApp.locator("#btn-complete")).toBeEnabled({ timeout: 5000 });

	// ─── Step 5: Make an AI completion call ─────────────────────────────────────
	// Intercept the OpenAI API call and return a mock response
	await context.route("https://api.openai.com/**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(MOCK_COMPLETION_RESPONSE),
		});
	});

	// Click the completion button
	await testApp.click("#btn-complete");

	// Wait for the response to appear
	await expect(testApp.locator(".response-box")).toBeVisible({ timeout: 15000 });
	await expect(testApp.locator(".response-box")).toContainText("Hello! How can I help you today?");

	// Verify usage metadata is displayed (use first .meta inside the completion section)
	await expect(testApp.locator("#completion-result .meta").first()).toContainText("tokens");

	// ─── Step 6: Verify budget was updated ─────────────────────────────────────
	// The budget section should now show spent > 0
	await expect(testApp.locator("#budget-result")).toContainText("spent", { timeout: 5000 });

	// The budget should show some amount spent (non-zero)
	const budgetText = await testApp.locator("#budget-result").textContent();
	// Extract spent value — the format is "X¢ spent (Y%)"
	const spentMatch = budgetText?.match(/(\d+)¢ spent/);
	expect(spentMatch).not.toBeNull();
	const spent = Number.parseInt(spentMatch![1], 10);
	expect(spent).toBeGreaterThan(0);

	// Budget remaining should be less than the original 500
	const remainingMatch = budgetText?.match(/(\d+)¢\s*remaining/);
	expect(remainingMatch).not.toBeNull();
	const remaining = Number.parseInt(remainingMatch![1], 10);
	expect(remaining).toBeLessThan(500);
	expect(remaining + spent).toBe(500);

	// ─── Step 7: Verify budget in popup too ────────────────────────────────────
	await popup.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(popup.locator("#lock-btn")).toBeVisible({ timeout: 5000 });

	// Go to apps tab to see the connected app with budget
	await popup.click('button[data-tab="apps"]');
	await expect(popup.locator(".app-card-header")).toBeVisible({ timeout: 3000 });

	// The app card should show budget info (spent/limit)
	await expect(popup.locator(".mono").first()).toBeVisible();
});

test("wallet lock/unlock cycle preserves state", async ({ context, extensionId }) => {
	const popup = await context.newPage();
	await popup.goto(`chrome-extension://${extensionId}/popup.html`);

	// Setup the wallet
	await expect(popup.locator("#pw1")).toBeVisible({ timeout: 5000 });
	await popup.fill("#pw1", TEST_PASSWORD);
	await popup.fill("#pw2", TEST_PASSWORD);
	await popup.click("#setup-btn");
	await expect(popup.locator("#lock-btn")).toBeVisible({ timeout: 5000 });

	// Add a key
	await popup.click('button[data-tab="keys"]');
	await expect(popup.locator("#show-form-btn")).toBeVisible({ timeout: 3000 });
	await popup.click("#show-form-btn");
	await popup.selectOption("#key-provider", "openai");
	await popup.fill("#key-label", "Lock Test Key");
	await popup.fill("#key-value", FAKE_API_KEY);
	await popup.click("#add-key-btn");
	await expect(popup.locator(".key-card")).toBeVisible({ timeout: 3000 });

	// Lock the wallet
	await popup.click("#keys-back");
	await expect(popup.locator("#lock-btn")).toBeVisible({ timeout: 3000 });
	await popup.click("#lock-btn");

	// Should show unlock screen
	await expect(popup.locator("#unlock-pw")).toBeVisible({ timeout: 5000 });

	// Try wrong password first
	await popup.fill("#unlock-pw", "wrong-password");
	await popup.click("#unlock-btn");
	await expect(popup.locator("#unlock-error")).toBeVisible({ timeout: 3000 });

	// Unlock with correct password
	await popup.fill("#unlock-pw", TEST_PASSWORD);
	await popup.click("#unlock-btn");
	await expect(popup.locator("#lock-btn")).toBeVisible({ timeout: 5000 });

	// Key should still be there
	await popup.click('button[data-tab="keys"]');
	await expect(popup.locator(".key-card")).toBeVisible({ timeout: 3000 });
	await expect(popup.locator(".key-card")).toContainText("Lock Test Key");
});
