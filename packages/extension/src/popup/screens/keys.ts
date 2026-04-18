// ─── Key Management Screen ───────────────────────────────────────────────────

import { keys } from "../api.js";

const ADD_KEY_STATE_KEY = "popup_add_key_state";

interface AddKeyState {
	provider: string;
	formOpen: boolean;
}

function saveAddKeyState(state: AddKeyState) {
	chrome.storage.session.set({ [ADD_KEY_STATE_KEY]: state });
}

function clearAddKeyState() {
	chrome.storage.session.remove(ADD_KEY_STATE_KEY);
}

async function getAddKeyState(): Promise<AddKeyState | null> {
	const result = await chrome.storage.session.get(ADD_KEY_STATE_KEY);
	return result[ADD_KEY_STATE_KEY] ?? null;
}

const PROVIDER_CONSOLE_URLS: Record<string, { label: string; url: string }> = {
	anthropic: { label: "Anthropic", url: "https://console.anthropic.com/settings/keys" },
	openai: { label: "OpenAI", url: "https://platform.openai.com/api-keys" },
	google: { label: "Google", url: "https://aistudio.google.com/apikey" },
	mistral: { label: "Mistral", url: "https://console.mistral.ai/api-keys" },
};

export function renderKeys(container: HTMLElement, onBack: () => void) {
	container.innerHTML = `
		<div class="screen-enter">
			<div class="header">
				<button class="back" id="keys-back">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
					Back
				</button>
				<h2 style="margin:0; font-size:13px; letter-spacing:0.04em;">API Keys</h2>
				<div style="width:40px;"></div>
			</div>

			<div id="keys-error" class="alert alert-error" style="display:none"></div>
			<div id="keys-list"></div>

			<button id="show-form-btn" class="btn btn-ghost" style="margin-bottom:10px;">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
				Add Key
			</button>

			<div id="add-key-section" style="display:none;">

			<div class="provider-links">
				<h2>Get a key from your provider</h2>
				${Object.entries(PROVIDER_CONSOLE_URLS)
					.map(
						([id, { label }]) => `
					<button class="provider-link-btn ${id}" data-provider-id="${id}">
						<span class="provider-badge ${id}">${label}</span>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
					</button>`,
					)
					.join("")}
			</div>

			<div class="divider-text"><span>or enter manually</span></div>

			<div class="card" id="add-key-form">
				<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
					<h2 style="margin:0;">New key</h2>
					<button id="hide-form-btn" class="back" style="font-size:11px;">Cancel</button>
				</div>
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
				<button id="add-key-btn" class="btn btn-primary">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
					Add Key
				</button>
			</div>

			</div>
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

	const formEl = container.querySelector<HTMLElement>("#add-key-form")!;
	const sectionEl = container.querySelector<HTMLElement>("#add-key-section")!;
	const showFormBtn = container.querySelector<HTMLButtonElement>("#show-form-btn")!;
	const hideFormBtn = container.querySelector<HTMLButtonElement>("#hide-form-btn")!;

	container.querySelector("#keys-back")!.addEventListener("click", () => {
		clearAddKeyState();
		onBack();
	});

	showFormBtn.addEventListener("click", () => {
		sectionEl.style.display = "block";
		showFormBtn.style.display = "none";
		saveAddKeyState({ provider: providerSelect.value, formOpen: true });
		valueInput.focus();
	});

	hideFormBtn.addEventListener("click", () => {
		sectionEl.style.display = "none";
		showFormBtn.style.display = "";
		errEl.style.display = "none";
		clearAddKeyState();
	});

	for (const btn of container.querySelectorAll<HTMLButtonElement>(".provider-link-btn")) {
		btn.addEventListener("click", () => {
			const providerId = btn.dataset.providerId!;
			const info = PROVIDER_CONSOLE_URLS[providerId];
			if (info) {
				saveAddKeyState({ provider: providerId, formOpen: true });
				window.open(info.url, "_blank");
				providerSelect.value = providerId;
				providerSelect.dispatchEvent(new Event("change"));
				valueInput.focus();
			}
		});
	}

	providerSelect.addEventListener("change", () => {
		baseurlGroup.style.display = providerSelect.value === "custom" ? "block" : "none";
	});

	// Restore form state if user was mid-flow (e.g. came back from provider console)
	getAddKeyState().then((saved) => {
		if (saved?.formOpen) {
			sectionEl.style.display = "block";
			showFormBtn.style.display = "none";
			if (saved.provider) {
				providerSelect.value = saved.provider;
				providerSelect.dispatchEvent(new Event("change"));
			}
			valueInput.focus();
		}
	});

	addBtn.addEventListener("click", async () => {
		errEl.style.display = "none";

		const provider = providerSelect.value;
		const label = labelInput.value.trim() || provider;
		const apiKey = valueInput.value.trim();
		const baseUrl = baseurlInput.value.trim() || undefined;

		if (!apiKey) {
			errEl.textContent = "API key is required.";
			errEl.style.display = "flex";
			return;
		}

		addBtn.disabled = true;
		addBtn.innerHTML = `<span style="animation:pulse 1s ease-in-out infinite;">Adding...</span>`;

		try {
			await keys.add({ provider, label, apiKey, baseUrl, isDefault: defaultCheck.checked });
			labelInput.value = "";
			valueInput.value = "";
			baseurlInput.value = "";
			sectionEl.style.display = "none";
			showFormBtn.style.display = "";
			clearAddKeyState();
			await refreshList();
		} catch (err) {
			errEl.textContent = String(err);
			errEl.style.display = "flex";
		} finally {
			addBtn.disabled = false;
			addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg> Add Key`;
		}
	});

	refreshList();

	async function refreshList() {
		try {
			const keyList = await keys.list();

			if (keyList.length === 0) {
				listEl.innerHTML = `
					<div class="empty-state" style="padding:16px;">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
						<div>No keys stored</div>
						<div style="font-size:12px; margin-top:2px;">Add your first API key below</div>
					</div>
				`;
				return;
			}

			listEl.innerHTML = keyList
				.map(
					(k) => `
				<div class="card key-card">
					<div class="key-card-info">
						<div class="key-card-name">
							<span class="provider-badge ${esc(k.provider)}">${esc(k.provider)}</span>
							${esc(k.label)}
							${k.isDefault ? '<span class="provider-badge default-tag">Default</span>' : ""}
						</div>
						<div class="key-card-meta">${esc(k.apiKey)}</div>
					</div>
					<button class="btn btn-ghost btn-sm" data-key-id="${esc(k.id)}" style="color:var(--danger); flex-shrink:0;">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
					</button>
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
			listEl.innerHTML = `<div class="alert alert-error">${esc(String(err))}</div>`;
		}
	}
}

function esc(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
