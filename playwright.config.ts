import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	retries: 0,
	use: {
		headless: false, // Extensions require headed mode
	},
	projects: [
		{
			name: "chromium",
			use: {
				// Chrome extension testing requires a persistent context,
				// configured in the test fixtures (see e2e/fixtures.ts)
			},
		},
	],
});
