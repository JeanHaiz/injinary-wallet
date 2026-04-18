// ─── Dashboard Screen ────────────────────────────────────────────────────────

import { approval, keys, perms, vault } from "../api.js";

type Screen = "keys" | "approval";

export function renderDashboard(container: HTMLElement, navigate: (screen: Screen) => void) {
	container.innerHTML = `
		<div class="header">
			<h1>AI Wallet</h1>
			<button id="lock-btn" class="btn btn-ghost btn-sm">Lock</button>
		</div>

		<div id="pending-banner" style="display:none"></div>

		<div class="nav">
			<button class="active" data-tab="overview">Overview</button>
			<button data-tab="keys">Keys</button>
			<button data-tab="apps">Apps</button>
		</div>

		<div id="tab-content"></div>
	`;

	const lockBtn = container.querySelector<HTMLButtonElement>("#lock-btn")!;
	const pendingBanner = container.querySelector<HTMLElement>("#pending-banner")!;
	const tabContent = container.querySelector<HTMLElement>("#tab-content")!;
	const navBtns = container.querySelectorAll<HTMLButtonElement>(".nav button");

	// Lock button
	lockBtn.addEventListener("click", async () => {
		await vault.lock();
		window.location.reload();
	});

	// Tab switching
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

	// Check for pending approvals
	checkPending();

	// Initial tab
	renderTab("overview");

	async function checkPending() {
		try {
			const pending = await approval.getPending();
			if (pending.length > 0) {
				const p = pending[0]!;
				pendingBanner.innerHTML = `
					<div class="card" style="border-color:#3b82f6; cursor:pointer;">
						<div style="display:flex; align-items:center; gap:8px;">
							<span class="status-dot yellow"></span>
							<strong>${escHtml(p.appName)}</strong> wants to connect
						</div>
						<div class="approval-origin" style="margin-top:4px;">${escHtml(p.origin)}</div>
						<div class="muted" style="margin-top:6px;">Click to review</div>
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

		el.innerHTML = `
			<div class="card">
				<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
					<span class="status-dot green"></span>
					<span>Wallet unlocked</span>
				</div>
				<div class="muted">${keyList.length} API key${keyList.length !== 1 ? "s" : ""} stored</div>
				<div class="muted">${(permList as unknown[]).length} app${(permList as unknown[]).length !== 1 ? "s" : ""} connected</div>
			</div>

			${
				keyList.length === 0
					? `<div class="alert alert-info">Add an API key to get started. Go to the Keys tab.</div>`
					: ""
			}
		`;
	} catch (err) {
		el.innerHTML = `<div class="alert alert-error">${escHtml(String(err))}</div>`;
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
			el.innerHTML = `<div class="card"><p class="muted">No apps connected yet.</p></div>`;
			return;
		}

		el.innerHTML = permList
			.map(
				(p) => `
			<div class="card">
				<div class="approval-origin">${escHtml(p.origin)}</div>
				<div class="muted" style="margin-top:4px;">
					Providers: ${p.allowedProviders.join(", ")} &middot;
					Budget: ${p.budget.spent}/${p.budget.amount}¢ ${p.budget.period}
				</div>
				<button class="btn btn-danger btn-sm" style="margin-top:8px;" data-origin="${escHtml(p.origin)}">
					Revoke
				</button>
			</div>
		`,
			)
			.join("");

		for (const btn of el.querySelectorAll<HTMLButtonElement>("[data-origin]")) {
			btn.addEventListener("click", async () => {
				await perms.revoke(btn.dataset.origin!);
				await renderApps(el);
			});
		}
	} catch (err) {
		el.innerHTML = `<div class="alert alert-error">${escHtml(String(err))}</div>`;
	}
}

function escHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
