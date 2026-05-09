import { describe, expect, it } from "vitest";
import {
	Connection,
	INJINARY_WALLET_INSTALL_URL,
	InjinaryWalletError,
	createInjinaryWallet,
	detect,
	isAvailable,
	openInstallPage,
	promptInstallIfMissing,
	showInstallPrompt,
} from "./index.js";

describe("public surface", () => {
	it("exports the documented runtime values", () => {
		expect(typeof createInjinaryWallet).toBe("function");
		expect(typeof detect).toBe("function");
		expect(typeof isAvailable).toBe("function");
		expect(typeof Connection).toBe("function");
		expect(typeof InjinaryWalletError).toBe("function");
	});

	it("createInjinaryWallet returns the documented shape", () => {
		const wallet = createInjinaryWallet();
		expect(typeof wallet.detect).toBe("function");
		expect(typeof wallet.isAvailable).toBe("function");
		expect(typeof wallet.connect).toBe("function");
	});

	it("InjinaryWalletError preserves code and message", () => {
		const err = new InjinaryWalletError(4001, "Wallet locked");
		expect(err).toBeInstanceOf(Error);
		expect(err.code).toBe(4001);
		expect(err.message).toBe("Wallet locked");
		expect(err.name).toBe("InjinaryWalletError");
	});
});

describe("isAvailable in a non-extension environment", () => {
	it("resolves to false when window.injinaryWallet is absent", async () => {
		await expect(isAvailable()).resolves.toBe(false);
	});
});

describe("install prompt", () => {
	it("exports the Chrome Web Store URL", () => {
		expect(INJINARY_WALLET_INSTALL_URL).toMatch(
			/^https:\/\/chromewebstore\.google\.com\/detail\/injinary-wallet\//,
		);
	});

	it("openInstallPage and showInstallPrompt are safe to call without a DOM", () => {
		expect(() => openInstallPage()).not.toThrow();
		const controller = showInstallPrompt();
		expect(controller).toMatchObject({
			show: expect.any(Function),
			hide: expect.any(Function),
			destroy: expect.any(Function),
		});
		expect(() => controller.show()).not.toThrow();
		expect(() => controller.destroy()).not.toThrow();
	});

	it("promptInstallIfMissing returns a controller when the wallet is absent", async () => {
		const controller = await promptInstallIfMissing();
		expect(controller).not.toBeNull();
		expect(typeof controller?.show).toBe("function");
	});
});
