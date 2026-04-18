// ─── Unlock Screen ───────────────────────────────────────────────────────────

import { vault } from "../api.js";

export function renderUnlock(container: HTMLElement, onUnlocked: () => void) {
	container.innerHTML = `
		<div class="screen-enter" style="padding-top:36px;">
			<img src="/logo.png" alt="Injinary" class="injinary-logo" />
			<div style="text-align:center; margin-bottom:28px;">
				<h1 style="font-size:18px;" class="brand-name">Injinary Wallet</h1>
				<p style="color:var(--text-muted); font-size:12.5px; margin-top:4px;">Enter password to unlock</p>
			</div>

			<div id="unlock-error" class="alert alert-error" style="display:none"></div>

			<div class="input-group">
				<input type="password" id="unlock-pw" placeholder="Password" autocomplete="current-password"
					style="text-align:center; font-size:15px; letter-spacing:0.1em; padding:12px;" />
			</div>

			<button id="unlock-btn" class="btn btn-primary">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
				Unlock
			</button>
		</div>
	`;

	const pw = container.querySelector<HTMLInputElement>("#unlock-pw")!;
	const btn = container.querySelector<HTMLButtonElement>("#unlock-btn")!;
	const errEl = container.querySelector<HTMLElement>("#unlock-error")!;

	btn.addEventListener("click", async () => {
		errEl.style.display = "none";
		if (!pw.value) return;

		btn.disabled = true;
		btn.innerHTML = `<span style="animation:pulse 1s ease-in-out infinite;">Decrypting...</span>`;

		try {
			await vault.unlock(pw.value);
			onUnlocked();
		} catch (_err) {
			errEl.textContent = "Wrong password.";
			errEl.style.display = "flex";
			btn.disabled = false;
			btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Unlock`;
			pw.value = "";
			pw.focus();
		}
	});

	pw.addEventListener("keydown", (e) => {
		if (e.key === "Enter") btn.click();
	});
	pw.focus();
}
