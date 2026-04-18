import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	// Inline @ai-wallet/shared — the SDK must be zero-dependency at runtime
	noExternal: ["@ai-wallet/shared"],
});
