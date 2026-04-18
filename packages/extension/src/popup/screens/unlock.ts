// ─── Unlock Screen ───────────────────────────────────────────────────────────

import { vault } from "../api.js";

export function renderUnlock(container: HTMLElement, onUnlocked: () => void) {
	container.innerHTML = `
		<div style="text-align:center; padding-top:40px; margin-bottom:24px;">
			<div style="font-size:40px; margin-bottom:8px;">&#128274;</div>
			<h1>AI Wallet</h1>
			<p class="subtitle" style="margin-bottom:0;">Enter your password to unlock</p>
		</div>

		<div id="unlock-error" class="alert alert-error" style="display:none"></div>

		<div class="input-group">
			<input type="password" id="unlock-pw" placeholder="Password" autocomplete="current-password" />
		</div>
		<button id="unlock-btn" class="btn btn-primary">Unlock</button>
	`;

	const pw = container.querySelector<HTMLInputElement>("#unlock-pw")!;
	const btn = container.querySelector<HTMLButtonElement>("#unlock-btn")!;
	const errEl = container.querySelector<HTMLElement>("#unlock-error")!;

	btn.addEventListener("click", async () => {
		errEl.style.display = "none";

		if (!pw.value) return;

		btn.disabled = true;
		btn.textContent = "Unlocking...";

		try {
			await vault.unlock(pw.value);
			onUnlocked();
		} catch (_err) {
			errEl.textContent = "Wrong password.";
			errEl.style.display = "block";
			btn.disabled = false;
			btn.textContent = "Unlock";
			pw.value = "";
			pw.focus();
		}
	});

	pw.addEventListener("keydown", (e) => {
		if (e.key === "Enter") btn.click();
	});

	pw.focus();
}
