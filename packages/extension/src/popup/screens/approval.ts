// ─── Permission Approval Screen ──────────────────────────────────────────────

import type { PendingApproval } from "@injinary-wallet/shared";
import { approval } from "../api.js";

export function renderApproval(container: HTMLElement, onDone: () => void) {
	container.innerHTML = `<div class="empty-state" style="padding-top:40px;"><span style="animation:pulse 1.5s ease-in-out infinite;">Loading...</span></div>`;
	loadPending(container, onDone);
}

async function loadPending(container: HTMLElement, onDone: () => void) {
	try {
		const pending = await approval.getPending();

		if (pending.length === 0) {
			container.innerHTML = `
				<div class="screen-enter">
					<div class="header">
						<button class="back" id="approval-back">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
							Back
						</button>
						<h2 style="margin:0; font-size:13px; letter-spacing:0.04em;">Approvals</h2>
						<div style="width:40px;"></div>
					</div>
					<div class="empty-state">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
						<div>No pending requests</div>
					</div>
				</div>
			`;
			container.querySelector("#approval-back")!.addEventListener("click", onDone);
			return;
		}

		renderApprovalForm(container, pending[0] as PendingApproval, onDone);
	} catch (err) {
		container.innerHTML = `<div class="alert alert-error">${esc(String(err))}</div>`;
	}
}

function renderApprovalForm(container: HTMLElement, pending: PendingApproval, onDone: () => void) {
	const providers: string[] = pending.requestedProviders ?? ["openai", "anthropic"];
	const defaultBudget = pending.requestedBudget?.amount ?? 500;
	const defaultPeriod = pending.requestedBudget?.period ?? "monthly";

	container.innerHTML = `
		<div class="screen-enter">
			<div class="header">
				<button class="back" id="approval-back">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
					Back
				</button>
				<h2 style="margin:0; font-size:13px; letter-spacing:0.04em;">Connection Request</h2>
				<div style="width:40px;"></div>
			</div>

			<div class="card card-glow" style="text-align:center; padding:20px;">
				<div style="font-weight:700; font-size:16px; margin-bottom:2px;">
					${esc(pending.appName)}
				</div>
				<div class="approval-origin">${esc(pending.origin)}</div>
				<div style="color:var(--text-muted); font-size:12px; margin-top:8px;">
					wants access to your AI providers
				</div>
			</div>

			<div id="approval-error" class="alert alert-error" style="display:none"></div>

			<div class="card">
				<h2>Providers</h2>
				<div style="display:flex; flex-direction:column; gap:4px;">
					${["openai", "anthropic", "google", "mistral"]
						.map(
							(p) => `
						<div class="checkbox-row">
							<input type="checkbox" id="prov-${p}" value="${p}"
								${providers.includes(p) ? "checked" : ""} />
							<label for="prov-${p}" style="display:flex; align-items:center; gap:6px;">
								<span class="provider-badge ${p}" style="margin:0;">${p}</span>
							</label>
						</div>
					`,
						)
						.join("")}
				</div>

				<div class="divider"></div>

				<h2>Budget</h2>
				<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
					<div class="input-group" style="margin-bottom:0;">
						<label for="budget-amount">Limit (cents)</label>
						<input id="budget-amount" type="number" value="${defaultBudget}" min="1" />
					</div>
					<div class="input-group" style="margin-bottom:0;">
						<label for="budget-period">Period</label>
						<select id="budget-period">
							<option value="daily" ${defaultPeriod === "daily" ? "selected" : ""}>Daily</option>
							<option value="weekly" ${defaultPeriod === "weekly" ? "selected" : ""}>Weekly</option>
							<option value="monthly" ${defaultPeriod === "monthly" ? "selected" : ""}>Monthly</option>
							<option value="total" ${defaultPeriod === "total" ? "selected" : ""}>Total</option>
						</select>
					</div>
				</div>

				<div class="divider"></div>

				<div class="checkbox-row">
					<input type="checkbox" id="auto-approve" checked />
					<label for="auto-approve">Auto-approve requests within budget</label>
				</div>
			</div>

			<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;">
				<button id="deny-btn" class="btn btn-ghost">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					Deny
				</button>
				<button id="approve-btn" class="btn btn-primary">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
					Approve
				</button>
			</div>
		</div>
	`;

	container.querySelector("#approval-back")!.addEventListener("click", onDone);

	const approveBtn = container.querySelector<HTMLButtonElement>("#approve-btn")!;
	const denyBtn = container.querySelector<HTMLButtonElement>("#deny-btn")!;
	const errEl = container.querySelector<HTMLElement>("#approval-error")!;

	denyBtn.addEventListener("click", async () => {
		denyBtn.disabled = true;
		try {
			await approval.resolve({ requestId: pending.requestId, approved: false });
			onDone();
		} catch (err) {
			errEl.textContent = String(err);
			errEl.style.display = "flex";
			denyBtn.disabled = false;
		}
	});

	approveBtn.addEventListener("click", async () => {
		errEl.style.display = "none";

		const selectedProviders: string[] = [];
		for (const cb of container.querySelectorAll<HTMLInputElement>('[id^="prov-"]')) {
			if (cb.checked) selectedProviders.push(cb.value);
		}

		if (selectedProviders.length === 0) {
			errEl.textContent = "Select at least one provider.";
			errEl.style.display = "flex";
			return;
		}

		const budgetAmount = Number(container.querySelector<HTMLInputElement>("#budget-amount")!.value);
		const budgetPeriod = container.querySelector<HTMLSelectElement>("#budget-period")!.value;
		const autoApprove = container.querySelector<HTMLInputElement>("#auto-approve")!.checked;

		approveBtn.disabled = true;
		approveBtn.innerHTML = `<span style="animation:pulse 1s ease-in-out infinite;">Approving...</span>`;

		try {
			await approval.resolve({
				requestId: pending.requestId,
				approved: true,
				grant: {
					origin: pending.origin,
					allowedProviders: selectedProviders,
					allowedModels: ["*"],
					budgetAmount,
					budgetPeriod,
					autoApprove,
					autoApproveMaxCostCents: 50,
					expiresAt: null,
				},
			});
			onDone();
		} catch (err) {
			errEl.textContent = String(err);
			errEl.style.display = "flex";
			approveBtn.disabled = false;
			approveBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Approve`;
		}
	});
}

function esc(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
