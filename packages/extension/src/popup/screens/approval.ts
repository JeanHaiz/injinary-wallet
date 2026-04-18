// ─── Permission Approval Screen ──────────────────────────────────────────────

import type { PendingApproval } from "@ai-wallet/shared";
import { approval } from "../api.js";

export function renderApproval(container: HTMLElement, onDone: () => void) {
	container.innerHTML = `<div class="card"><p class="muted">Loading...</p></div>`;

	loadPending(container, onDone);
}

async function loadPending(container: HTMLElement, onDone: () => void) {
	try {
		const pending = await approval.getPending();

		if (pending.length === 0) {
			container.innerHTML = `
				<div class="header">
					<button class="back" id="approval-back">&larr; Back</button>
					<h2 style="margin:0;">Approvals</h2>
					<div></div>
				</div>
				<div class="card"><p class="muted">No pending requests.</p></div>
			`;
			container.querySelector("#approval-back")!.addEventListener("click", onDone);
			return;
		}

		renderApprovalForm(container, pending[0] as PendingApproval, onDone);
	} catch (err) {
		container.innerHTML = `<div class="alert alert-error">${escHtml(String(err))}</div>`;
	}
}

function renderApprovalForm(container: HTMLElement, pending: PendingApproval, onDone: () => void) {
	const providers: string[] = pending.requestedProviders ?? ["openai", "anthropic"];
	const defaultBudget = pending.requestedBudget?.amount ?? 500;
	const defaultPeriod = pending.requestedBudget?.period ?? "monthly";

	container.innerHTML = `
		<div class="header">
			<button class="back" id="approval-back">&larr; Back</button>
			<h2 style="margin:0;">Connection Request</h2>
			<div></div>
		</div>

		<div class="card" style="border-color: #3b82f6;">
			<div style="font-weight:600; font-size:16px; margin-bottom:4px;">
				${escHtml(pending.appName)}
			</div>
			<div class="approval-origin">${escHtml(pending.origin)}</div>
			<div class="muted" style="margin-top:6px;">wants access to your AI providers</div>
		</div>

		<div id="approval-error" class="alert alert-error" style="display:none"></div>

		<div class="card">
			<h2>Permissions</h2>

			<div class="input-group">
				<label>Allowed providers</label>
				<div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
					${["openai", "anthropic", "google", "mistral"]
						.map(
							(p) => `
						<div class="checkbox-row">
							<input type="checkbox" id="prov-${p}" value="${p}"
								${providers.includes(p) ? "checked" : ""} />
							<label for="prov-${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</label>
						</div>
					`,
						)
						.join("")}
				</div>
			</div>

			<div class="input-group">
				<label for="budget-amount">Budget limit (cents)</label>
				<input id="budget-amount" type="number" value="${defaultBudget}" min="1" />
			</div>

			<div class="input-group">
				<label for="budget-period">Budget period</label>
				<select id="budget-period">
					<option value="daily" ${defaultPeriod === "daily" ? "selected" : ""}>Daily</option>
					<option value="weekly" ${defaultPeriod === "weekly" ? "selected" : ""}>Weekly</option>
					<option value="monthly" ${defaultPeriod === "monthly" ? "selected" : ""}>Monthly</option>
					<option value="total" ${defaultPeriod === "total" ? "selected" : ""}>Total (no reset)</option>
				</select>
			</div>

			<div class="checkbox-row">
				<input type="checkbox" id="auto-approve" checked />
				<label for="auto-approve">Auto-approve requests under budget</label>
			</div>
		</div>

		<div style="display:flex; gap:8px;">
			<button id="deny-btn" class="btn btn-ghost" style="flex:1;">Deny</button>
			<button id="approve-btn" class="btn btn-primary" style="flex:1;">Approve</button>
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
			errEl.style.display = "block";
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
			errEl.style.display = "block";
			return;
		}

		const budgetAmount = Number(container.querySelector<HTMLInputElement>("#budget-amount")!.value);
		const budgetPeriod = container.querySelector<HTMLSelectElement>("#budget-period")!.value;
		const autoApprove = container.querySelector<HTMLInputElement>("#auto-approve")!.checked;

		approveBtn.disabled = true;
		approveBtn.textContent = "Approving...";

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
			errEl.style.display = "block";
			approveBtn.disabled = false;
			approveBtn.textContent = "Approve";
		}
	});
}

function escHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}
