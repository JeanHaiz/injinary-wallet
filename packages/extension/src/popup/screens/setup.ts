// ─── First-Run Setup Screen ──────────────────────────────────────────────────

import { vault } from "../api.js";

export function renderSetup(container: HTMLElement, onComplete: () => void) {
	container.innerHTML = `
		<h1>Welcome to AI Wallet</h1>
		<p class="subtitle">Create a password to encrypt your API keys. There is no recovery — choose something you'll remember.</p>

		<div id="setup-error" class="alert alert-error" style="display:none"></div>

		<div class="input-group">
			<label for="pw1">Password</label>
			<input type="password" id="pw1" placeholder="Enter a strong password" autocomplete="new-password" />
		</div>
		<div class="input-group">
			<label for="pw2">Confirm password</label>
			<input type="password" id="pw2" placeholder="Re-enter your password" autocomplete="new-password" />
		</div>
		<button id="setup-btn" class="btn btn-primary">Create Wallet</button>
		<p class="muted" style="margin-top:12px; text-align:center;">
			Your password never leaves this device.
		</p>
	`;

	const pw1 = container.querySelector<HTMLInputElement>("#pw1")!;
	const pw2 = container.querySelector<HTMLInputElement>("#pw2")!;
	const btn = container.querySelector<HTMLButtonElement>("#setup-btn")!;
	const errEl = container.querySelector<HTMLElement>("#setup-error")!;

	function showError(msg: string) {
		errEl.textContent = msg;
		errEl.style.display = "block";
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
		btn.textContent = "Creating...";

		try {
			await vault.initialize(password);
			onComplete();
		} catch (err) {
			showError(String(err));
			btn.disabled = false;
			btn.textContent = "Create Wallet";
		}
	});

	// Submit on Enter
	pw2.addEventListener("keydown", (e) => {
		if (e.key === "Enter") btn.click();
	});

	pw1.focus();
}
