import path from "node:path";
import { type BrowserContext, chromium, test as base } from "@playwright/test";

const EXTENSION_PATH = path.resolve(__dirname, "../packages/extension/.output/chrome-mv3");

// Custom fixture that launches Chrome with the extension loaded
export const test = base.extend<{
	context: BrowserContext;
	extensionId: string;
}>({
	// biome-ignore lint: Playwright fixture pattern requires destructuring
	context: async ({}, use) => {
		const context = await chromium.launchPersistentContext("", {
			headless: false,
			args: [
				`--disable-extensions-except=${EXTENSION_PATH}`,
				`--load-extension=${EXTENSION_PATH}`,
				"--no-first-run",
				"--disable-gpu",
			],
		});
		await use(context);
		await context.close();
	},
	extensionId: async ({ context }, use) => {
		// Wait for the service worker to register
		let [background] = context.serviceWorkers();
		if (!background) {
			background = await context.waitForEvent("serviceworker");
		}
		const extensionId = background.url().split("/")[2];
		await use(extensionId);
	},
});

export const expect = test.expect;
