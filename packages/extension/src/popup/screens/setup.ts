// ─── First-Run Setup Screen ──────────────────────────────────────────────────

import { vault } from "../api.js";

export function renderSetup(container: HTMLElement, onComplete: () => void) {
	container.innerHTML = `
		<div class="screen-enter" style="padding-top:12px;">
			<img src="/logo-wordmark.png" alt="injinary" class="injinary-logo-wordmark" />
			<div style="text-align:center; margin-bottom:24px;">
				<h1>Create your vault</h1>
				<p class="subtitle" style="margin-top:6px; margin-bottom:0;">
					Your password encrypts all API keys locally.<br>
					There is no recovery — choose wisely.
				</p>
			</div>

			<div id="setup-error" class="alert alert-error" style="display:none"></div>

			<div class="input-group">
				<label for="pw1">Password</label>
				<input type="password" id="pw1" placeholder="At least 6 characters" autocomplete="new-password" />
			</div>
			<div class="input-group">
				<label for="pw2">Confirm</label>
				<input type="password" id="pw2" placeholder="Re-enter password" autocomplete="new-password" />
			</div>

			<button id="setup-btn" class="btn btn-primary" style="margin-top:4px;">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
				Create Wallet
			</button>

			<p class="muted" style="margin-top:14px; text-align:center;">
				Keys are encrypted with AES-256-GCM and never leave your device.
			</p>
		</div>
	`;

	const pw1 = container.querySelector<HTMLInputElement>("#pw1")!;
	const pw2 = container.querySelector<HTMLInputElement>("#pw2")!;
	const btn = container.querySelector<HTMLButtonElement>("#setup-btn")!;
	const errEl = container.querySelector<HTMLElement>("#setup-error")!;

	function showError(msg: string) {
		errEl.textContent = msg;
		errEl.style.display = "flex";
	}

	btn.addEventListener("click", async () => {
		errEl.style.display = "none";
		const password = pw1.value;
		const confirm = pw2.value;

		if (password.length < 6) {
			showError("Password must be at least 6 characters.");
			return;
		}
		if (password !== confirm) {
			showError("Passwords don't match.");
			return;
		}

		btn.disabled = true;
		btn.innerHTML = `<span style="animation:pulse 1s ease-in-out infinite;">Creating vault...</span>`;

		try {
			await vault.initialize(password);
			onComplete();
		} catch (err) {
			showError(String(err));
			btn.disabled = false;
			btn.textContent = "Create Wallet";
		}
	});

	pw2.addEventListener("keydown", (e) => {
		if (e.key === "Enter") btn.click();
	});
	pw1.focus();
}
