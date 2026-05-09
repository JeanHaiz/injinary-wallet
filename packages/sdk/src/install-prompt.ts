import { isAvailable } from "./detect.js";

/** Chrome Web Store URL where the user can install the Injinary Wallet extension. */
export const INJINARY_WALLET_INSTALL_URL =
	"https://chromewebstore.google.com/detail/injinary-wallet/emnpfdhpjmgbdgmbpcbloncillceljgp";

export type InstallPromptPosition =
	| "top"
	| "bottom"
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right";

export interface InstallPromptOptions {
	/** Friendly app name shown in the banner heading. */
	appName?: string;
	/** Banner position. Defaults to "bottom-right". */
	position?: InstallPromptPosition;
	/** Override the install URL (e.g. localised store, future Edge / Firefox add-on). */
	installUrl?: string;
	/** Override the body copy. */
	message?: string;
	/** CTA button label. Defaults to "Install Wallet". */
	ctaLabel?: string;
	/** Show a "Not now" dismiss button. Defaults to true. */
	dismissible?: boolean;
	/** Stacking context. Defaults near the top of the int32 range so it floats above app UI. */
	zIndex?: number;
	/** Called when the user clicks the install button (after the new tab opens). */
	onInstall?: () => void;
	/** Called when the user dismisses the banner. */
	onDismiss?: () => void;
}

export interface InstallPromptController {
	/** The banner root element. May be detached if `destroy()` was called. */
	readonly element: HTMLElement | null;
	show(): void;
	hide(): void;
	destroy(): void;
}

const NOOP_CONTROLLER: InstallPromptController = {
	element: null,
	show() {},
	hide() {},
	destroy() {},
};

/** Open the install page in a new tab. No-op outside a browser. */
export function openInstallPage(url: string = INJINARY_WALLET_INSTALL_URL): void {
	if (typeof window === "undefined") return;
	window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Render a small floating banner pointing the user to the Chrome Web Store.
 * Pairs with `isAvailable()`:
 *
 * ```ts
 * if (!(await isAvailable())) showInstallPrompt({ appName: "My App" });
 * ```
 *
 * Outside a browser environment this returns a no-op controller.
 */
export function showInstallPrompt(options: InstallPromptOptions = {}): InstallPromptController {
	if (typeof document === "undefined") return NOOP_CONTROLLER;

	const {
		appName,
		position = "bottom-right",
		installUrl = INJINARY_WALLET_INSTALL_URL,
		message,
		ctaLabel = "Install Wallet",
		dismissible = true,
		zIndex = 2_147_483_646,
		onInstall,
		onDismiss,
	} = options;

	const root = document.createElement("div");
	root.setAttribute("data-injinary-install-prompt", "");
	root.style.cssText = [
		"position:fixed",
		positionToCss(position),
		`z-index:${zIndex}`,
		"max-width:340px",
		"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
		"font-size:14px",
		"line-height:1.45",
		"background:#18181b",
		"color:#e4e4e7",
		"border:1px solid #27272a",
		"border-radius:12px",
		"padding:14px 16px",
		"box-shadow:0 10px 30px rgba(0,0,0,0.35)",
		"display:flex",
		"flex-direction:column",
		"gap:10px",
	].join(";");

	const title = document.createElement("div");
	title.style.cssText = "font-weight:600;font-size:14px;color:#fafafa";
	title.textContent = appName ? `${appName} uses Injinary Wallet` : "Injinary Wallet required";

	const body = document.createElement("div");
	body.style.cssText = "color:#a1a1aa;font-size:13px";
	body.textContent =
		message ??
		"Install the Injinary Wallet browser extension to bring your own AI keys — your keys never leave your browser.";

	const actions = document.createElement("div");
	actions.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:2px";

	const cta = document.createElement("button");
	cta.type = "button";
	cta.textContent = ctaLabel;
	cta.style.cssText = [
		"all:unset",
		"cursor:pointer",
		"background:#3b82f6",
		"color:#fff",
		"font-weight:500",
		"padding:8px 14px",
		"border-radius:8px",
		"font-size:13px",
	].join(";");
	cta.addEventListener("click", () => {
		openInstallPage(installUrl);
		onInstall?.();
	});
	actions.appendChild(cta);

	const controller: InstallPromptController = {
		element: root,
		show() {
			if (!root.isConnected) document.body.appendChild(root);
			root.style.display = "flex";
		},
		hide() {
			root.style.display = "none";
		},
		destroy() {
			root.remove();
		},
	};

	if (dismissible) {
		const close = document.createElement("button");
		close.type = "button";
		close.setAttribute("aria-label", "Dismiss");
		close.textContent = "Not now";
		close.style.cssText = [
			"all:unset",
			"cursor:pointer",
			"color:#a1a1aa",
			"padding:8px 10px",
			"border-radius:8px",
			"font-size:13px",
		].join(";");
		close.addEventListener("click", () => {
			controller.hide();
			onDismiss?.();
		});
		actions.appendChild(close);
	}

	root.appendChild(title);
	root.appendChild(body);
	root.appendChild(actions);

	controller.show();
	return controller;
}

/**
 * If the wallet is not installed, render the install prompt and return its controller.
 * If the wallet is already installed, returns `null` and renders nothing.
 */
export async function promptInstallIfMissing(
	options: InstallPromptOptions & { detectTimeoutMs?: number } = {},
): Promise<InstallPromptController | null> {
	if (await isAvailable(options.detectTimeoutMs)) return null;
	return showInstallPrompt(options);
}

function positionToCss(position: InstallPromptPosition): string {
	switch (position) {
		case "top":
			return "top:16px;left:50%;transform:translateX(-50%)";
		case "bottom":
			return "bottom:16px;left:50%;transform:translateX(-50%)";
		case "top-left":
			return "top:16px;left:16px";
		case "top-right":
			return "top:16px;right:16px";
		case "bottom-left":
			return "bottom:16px;left:16px";
		case "bottom-right":
			return "bottom:16px;right:16px";
	}
}
