// ─── Key Management Screen ───────────────────────────────────────────────────

import { keys } from "../api.js";

export function renderKeys(container: HTMLElement, onBack: () => void) {
	container.innerHTML = `
		<div class="header">
			<button class="back" id="keys-back">&larr; Back</button>
			<h2 style="margin:0;">API Keys</h2>
			<div></div>
		</div>

		<div id="keys-error" class="alert alert-error" style="display:none"></div>
		<div id="keys-list"></div>

		<div class="card" id="add-key-form">
			<h2>Add a key</h2>
			<div class="input-group">
				<label for="key-provider">Provider</label>
				<select id="key-provider">
					<option value="openai">OpenAI</option>
					<option value="anthropic">Anthropic</option>
					<option value="google">Google</option>
					<option value="mistral">Mistral</option>
					<option value="custom">Custom (OpenAI-compatible)</option>
				</select>
			</div>
			<div class="input-group">
				<label for="key-label">Label</label>
				<input id="key-label" placeholder="e.g. Personal, Work" />
			</div>
			<div class="input-group">
				<label for="key-value">API Key</label>
				<input id="key-value" type="password" placeholder="sk-..." autocomplete="off" />
			</div>
			<div class="input-group" id="baseurl-group" style="display:none">
				<label for="key-baseurl">Base URL</label>
				<input id="key-baseurl" placeholder="https://api.example.com/v1" />
			</div>
			<div class="checkbox-row">
				<input type="checkbox" id="key-default" checked />
				<label for="key-default">Set as default for this provider</label>
			</div>
			<button id="add-key-btn" class="btn btn-primary">Add Key</button>
		</div>
	`;

	const listEl = container.querySelector<HTMLElement>("#keys-list")!;
	const errEl = container.querySelector<HTMLElement>("#keys-error")!;
	const providerSelect = container.querySelector<HTMLSelectElement>("#key-provider")!;
	const labelInput = container.querySelector<HTMLInputElement>("#key-label")!;
	const valueInput = container.querySelector<HTMLInputElement>("#key-value")!;
	const baseurlGroup = container.querySelector<HTMLElement>("#baseurl-group")!;
	const baseurlInput = container.querySelector<HTMLInputElement>("#key-baseurl")!;
	const defaultCheck = container.querySelector<HTMLInputElement>("#key-default")!;
	const addBtn = container.querySelector<HTMLButtonElement>("#add-key-btn")!;

	container.querySelector("#keys-back")!.addEventListener("click", onBack);

	// Show base URL field for custom provider
	providerSelect.addEventListener("change", () => {
		baseurlGroup.style.display = providerSelect.value === "custom" ? "block" : "none";
	});

	// Add key handler
	addBtn.addEventListener("click", async () => {
		errEl.style.display = "none";

		const provider = providerSelect.value;
		const label = labelInput.value.trim() || provider;
		const apiKey = valueInput.value.trim();
		const baseUrl = baseurlInput.value.trim() || undefined;

		if (!apiKey) {
			errEl.textContent = "API key is required.";
			errEl.style.display = "block";
			return;
		}

		addBtn.disabled = true;
		addBtn.textContent = "Adding...";

		try {
			await keys.add({
				provider,
				label,
				apiKey,
				baseUrl,
				isDefault: defaultCheck.checked,
			});

			// Clear form
			labelInput.value = "";
			valueInput.value = "";
			baseurlInput.value = "";

			await refreshList();
		} catch (err) {
			errEl.textContent = String(err);
			errEl.style.display = "block";
		} finally {
			addBtn.disabled = false;
			addBtn.textContent = "Add Key";
		}
	});

	refreshList();

	async function refreshList() {
		try {
			const keyList = await keys.list();

			if (keyList.length === 0) {
				listEl.innerHTML = `
					<div class="card">
						<p class="muted">No API keys stored yet. Add one below.</p>
					</div>
				`;
				return;
			}

			listEl.innerHTML = keyList
				.map(
					(k) => `
				<div class="card" style="display:flex; align-items:center; justify-content:space-between;">
					<div>
						<div style="font-weight:500;">
							${escHtml(k.label)}
							${k.isDefault ? '<span style="color:#22c55e; font-size:11px; margin-left:6px;">DEFAULT</span>' : ""}
						</div>
						<div class="muted">${escHtml(k.provider)} &middot; ${escHtml(k.apiKey)}</div>
					</div>
					<button class="btn btn-danger btn-sm" data-key-id="${escHtml(k.id)}">Remove</button>
				</div>
			`,
				)
				.join("");

			for (const btn of listEl.querySelectorAll<HTMLButtonElement>("[data-key-id]")) {
				btn.addEventListener("click", async () => {
					await keys.remove(btn.dataset.keyId!);
					await refreshList();
				});
			}
		} catch (err) {
			listEl.innerHTML = `<div class="alert alert-error">${escHtml(String(err))}</div>`;
		}
	}
}

function escHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
