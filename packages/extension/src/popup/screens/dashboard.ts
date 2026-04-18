// ─── Dashboard Screen ────────────────────────────────────────────────────────

import { approval, keys, perms, vault } from "../api.js";

type Screen = "keys" | "approval";

export function renderDashboard(container: HTMLElement, navigate: (screen: Screen) => void) {
	container.innerHTML = `
		<div class="screen-enter">
			<div class="header">
				<div style="display:flex; align-items:center; gap:8px;">
					<img src="/logo.png" alt="Injinary" class="injinary-logo-sm" />
					<h1 style="font-size:16px;" class="brand-name">Injinary</h1>
				</div>
				<button id="lock-btn" class="btn btn-ghost btn-sm">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
					Lock
				</button>
			</div>

			<div id="pending-banner" style="display:none"></div>

			<div class="nav">
				<button class="active" data-tab="overview">Overview</button>
				<button data-tab="keys">Keys</button>
				<button data-tab="apps">Apps</button>
			</div>

			<div id="tab-content"></div>
		</div>
	`;

	const lockBtn = container.querySelector<HTMLButtonElement>("#lock-btn")!;
	const pendingBanner = container.querySelector<HTMLElement>("#pending-banner")!;
	const tabContent = container.querySelector<HTMLElement>("#tab-content")!;
	const navBtns = container.querySelectorAll<HTMLButtonElement>(".nav button");

	lockBtn.addEventListener("click", async () => {
		await vault.lock();
		window.location.reload();
	});

	let activeTab = "overview";
	for (const btn of navBtns) {
		btn.addEventListener("click", () => {
			const tab = btn.dataset.tab!;
			if (tab === activeTab) return;
			activeTab = tab;
			for (const b of navBtns) b.classList.toggle("active", b === btn);
			renderTab(tab);
		});
	}

	checkPending();
	renderTab("overview");

	async function checkPending() {
		try {
			const pending = await approval.getPending();
			if (pending.length > 0) {
				const p = pending[0]!;
				pendingBanner.innerHTML = `
					<div class="card card-glow" style="cursor:pointer; margin-bottom:14px;">
						<div style="display:flex; align-items:center; gap:9px;">
							<span class="status-dot yellow"></span>
							<div>
								<div style="font-weight:600; font-size:13.5px;">${esc(p.appName)}</div>
								<div style="font-size:12px; color:var(--text-muted);">wants to connect &middot; tap to review</div>
							</div>
						</div>
					</div>
				`;
				pendingBanner.style.display = "block";
				pendingBanner.addEventListener("click", () => navigate("approval"));
			}
		} catch {
			// No pending
		}
	}

	async function renderTab(tab: string) {
		if (tab === "overview") {
			await renderOverview(tabContent);
		} else if (tab === "keys") {
			navigate("keys");
		} else if (tab === "apps") {
			await renderApps(tabContent);
		}
	}
}

async function renderOverview(el: HTMLElement) {
	try {
		const keyList = await keys.list();
		const permList = await perms.list();
		const keyCount = keyList.length;
		const appCount = (permList as unknown[]).length;

		el.innerHTML = `
			<div class="card" style="display:flex; align-items:center; gap:10px; padding:14px 16px;">
				<span class="status-dot green"></span>
				<span style="font-weight:500; font-size:13.5px;">Wallet unlocked</span>
			</div>

			<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:2px;">
				<div class="card" style="text-align:center; padding:18px 12px;">
					<div style="font-size:26px; font-weight:700; letter-spacing:-0.03em; color:var(--text-primary);">${keyCount}</div>
					<div style="font-size:11px; color:var(--text-muted); margin-top:2px; text-transform:uppercase; letter-spacing:0.06em; font-weight:600;">API Key${keyCount !== 1 ? "s" : ""}</div>
				</div>
				<div class="card" style="text-align:center; padding:18px 12px;">
					<div style="font-size:26px; font-weight:700; letter-spacing:-0.03em; color:var(--text-primary);">${appCount}</div>
					<div style="font-size:11px; color:var(--text-muted); margin-top:2px; text-transform:uppercase; letter-spacing:0.06em; font-weight:600;">App${appCount !== 1 ? "s" : ""}</div>
				</div>
			</div>

			${
				keyCount === 0
					? `<div class="alert alert-info" style="margin-top:10px;">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
						<span>Add an API key to get started. Go to the <strong>Keys</strong> tab.</span>
					</div>`
					: ""
			}
		`;
	} catch (err) {
		el.innerHTML = `<div class="alert alert-error">${esc(String(err))}</div>`;
	}
}

async function renderApps(el: HTMLElement) {
	try {
		const permList = (await perms.list()) as {
			origin: string;
			allowedProviders: string[];
			budget: { amount: number; spent: number; period: string };
		}[];

		if (permList.length === 0) {
			el.innerHTML = `
				<div class="empty-state">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
					<div>No apps connected yet</div>
					<div style="font-size:12px; margin-top:2px;">Apps will appear here when they request access</div>
				</div>
			`;
			return;
		}

		el.innerHTML = permList
			.map((p) => {
				const pct = p.budget.amount > 0 ? Math.round((p.budget.spent / p.budget.amount) * 100) : 0;
				const barClass = pct > 80 ? "danger" : pct > 50 ? "warning" : "";
				const hostname = p.origin.replace(/^https?:\/\//, "");
				return `
				<div class="card">
					<div class="app-card-header">
						<div style="font-weight:600; font-size:13px;">${esc(hostname)}</div>
						<button class="btn btn-ghost btn-sm" data-origin="${esc(p.origin)}" style="color:var(--danger);">Revoke</button>
					</div>
					<div style="display:flex; gap:4px; margin-bottom:8px;">
						${p.allowedProviders.map((prov) => `<span class="provider-badge ${prov}">${prov}</span>`).join("")}
					</div>
					<div style="display:flex; justify-content:space-between; align-items:baseline;">
						<span style="font-size:12px; color:var(--text-secondary);">Budget</span>
						<span class="mono">${p.budget.spent} / ${p.budget.amount}¢ <span class="muted">${p.budget.period}</span></span>
					</div>
					<div class="budget-bar"><div class="budget-bar-fill ${barClass}" style="width:${pct}%"></div></div>
				</div>
			`;
			})
			.join("");

		for (const btn of el.querySelectorAll<HTMLButtonElement>("[data-origin]")) {
			btn.addEventListener("click", async () => {
				await perms.revoke(btn.dataset.origin!);
				await renderApps(el);
			});
		}
	} catch (err) {
		el.innerHTML = `<div class="alert alert-error">${esc(String(err))}</div>`;
	}
}

function esc(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
