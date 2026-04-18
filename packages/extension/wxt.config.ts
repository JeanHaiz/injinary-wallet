import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	manifest: {
		name: "AI Wallet",
		description:
			"Manage AI API keys, budgets, and permissions. Let open source apps use AI without exposing your keys.",
		permissions: ["storage", "activeTab"],
		optional_permissions: ["unlimitedStorage"],
		content_security_policy: {
			extension_pages: "script-src 'self'; object-src 'none';",
		},
	},
});
