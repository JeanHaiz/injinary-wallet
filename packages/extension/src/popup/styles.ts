// ─── Injinary Wallet — Popup Styles ──────────────────────────────────────────
// Deep vault aesthetic — teal glow, orange energy, shield-swirl motif.

export function injectStyles() {
	const style = document.createElement("style");
	style.textContent = `
		@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

		:root {
			--bg-base: #04080F;
			--bg-surface: #0B2545;
			--bg-elevated: #134074;
			--bg-hover: #1a4d85;

			--border: rgba(72, 202, 228, 0.12);
			--border-subtle: rgba(72, 202, 228, 0.06);
			--border-focus: #0096C7;

			--text-primary: #E0FAFF;
			--text-secondary: #94A3B8;
			--text-muted: #4a6a8a;

			--accent: #0096C7;
			--accent-dim: rgba(0, 150, 199, 0.12);
			--accent-glow: rgba(72, 202, 228, 0.08);
			--glow: #48CAE4;

			--energy: #FB8500;
			--energy-dim: rgba(251, 133, 0, 0.12);

			--success: #10b981;
			--success-dim: rgba(16, 185, 129, 0.12);
			--warning: #FB8500;
			--warning-dim: rgba(251, 133, 0, 0.12);
			--danger: #f43f5e;
			--danger-dim: rgba(244, 63, 94, 0.10);

			--radius: 10px;
			--radius-sm: 6px;
			--radius-lg: 14px;

			--font: "DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
			--font-display: "Montserrat", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
			--font-mono: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace;

			--ease: cubic-bezier(0.16, 1, 0.3, 1);

			--gradient-primary: linear-gradient(135deg, #134074 0%, #0096C7 100%);
			--gradient-energy: linear-gradient(135deg, #FB8500 0%, #FFB627 100%);
			--gradient-glow: linear-gradient(135deg, rgba(72, 202, 228, 0.06), transparent 60%);
		}

		* { margin: 0; padding: 0; box-sizing: border-box; }

		body {
			width: 380px;
			min-height: 520px;
			font-family: var(--font);
			background: var(--bg-base);
			color: var(--text-primary);
			font-size: 13.5px;
			line-height: 1.5;
			-webkit-font-smoothing: antialiased;
		}

		/* Subtle noise overlay for depth */
		body::before {
			content: '';
			position: fixed;
			inset: 0;
			background:
				radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0, 150, 199, 0.04) 0%, transparent 70%),
				radial-gradient(ellipse 50% 40% at 80% 100%, rgba(251, 133, 0, 0.03) 0%, transparent 70%);
			pointer-events: none;
			z-index: 0;
		}

		#app {
			padding: 18px;
			animation: fadeIn 0.25s var(--ease);
			position: relative;
			z-index: 1;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(4px); }
			to { opacity: 1; transform: translateY(0); }
		}

		@keyframes slideUp {
			from { opacity: 0; transform: translateY(12px); }
			to { opacity: 1; transform: translateY(0); }
		}

		@keyframes pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.5; }
		}

		@keyframes shimmer {
			0% { background-position: -200% 0; }
			100% { background-position: 200% 0; }
		}

		@keyframes glowPulse {
			0%, 100% { box-shadow: 0 0 12px rgba(72, 202, 228, 0.15); }
			50% { box-shadow: 0 0 24px rgba(72, 202, 228, 0.25); }
		}

		/* ── Typography ── */
		h1 {
			font-family: var(--font-display);
			font-size: 18px;
			font-weight: 800;
			letter-spacing: -0.02em;
			color: var(--text-primary);
		}
		h2 {
			font-family: var(--font-display);
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--text-muted);
			margin-bottom: 10px;
		}
		.subtitle {
			color: var(--text-secondary);
			font-size: 13px;
			margin-bottom: 20px;
			line-height: 1.6;
		}
		.muted { color: var(--text-muted); font-size: 12px; }
		.mono { font-family: var(--font-mono); font-size: 12px; }

		/* ── Cards ── */
		.card {
			background: var(--bg-surface);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			padding: 16px;
			margin-bottom: 10px;
			transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
		}
		.card:hover { border-color: rgba(72, 202, 228, 0.2); }
		.card-glow {
			background: var(--gradient-glow), var(--bg-surface);
			border-color: rgba(0, 150, 199, 0.25);
			animation: glowPulse 3s ease-in-out infinite;
		}

		/* ── Buttons ── */
		.btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 7px;
			border: none;
			border-radius: var(--radius);
			padding: 11px 20px;
			font-family: var(--font-display);
			font-size: 13px;
			font-weight: 700;
			cursor: pointer;
			transition: all 0.2s var(--ease);
			width: 100%;
			position: relative;
			overflow: hidden;
			letter-spacing: 0.01em;
		}
		.btn::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%);
			pointer-events: none;
		}
		.btn:active:not(:disabled) { transform: scale(0.98); }
		.btn:disabled { opacity: 0.35; cursor: not-allowed; }

		.btn-primary {
			background: var(--gradient-primary);
			color: #fff;
			box-shadow: 0 2px 8px rgba(0, 150, 199, 0.2), inset 0 1px 0 rgba(255,255,255,0.1);
		}
		.btn-primary:hover:not(:disabled) {
			box-shadow: 0 4px 16px rgba(0, 150, 199, 0.35), inset 0 1px 0 rgba(255,255,255,0.1);
			filter: brightness(1.1);
		}

		.btn-danger {
			background: var(--danger);
			color: #fff;
			box-shadow: 0 1px 2px rgba(0,0,0,0.3);
		}
		.btn-danger:hover:not(:disabled) { background: #e11d48; }

		.btn-ghost {
			background: rgba(19, 64, 116, 0.4);
			color: var(--text-secondary);
			border: 1px solid var(--border);
		}
		.btn-ghost:hover:not(:disabled) {
			background: rgba(19, 64, 116, 0.7);
			color: var(--text-primary);
			border-color: rgba(72, 202, 228, 0.2);
		}

		.btn-sm {
			padding: 5px 12px;
			font-size: 11.5px;
			width: auto;
			border-radius: var(--radius-sm);
		}

		/* ── Inputs ── */
		.input-group { margin-bottom: 12px; }
		.input-group label {
			display: block;
			font-family: var(--font-display);
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
			margin-bottom: 5px;
		}
		input, select {
			width: 100%;
			padding: 10px 12px;
			background: var(--bg-base);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			color: var(--text-primary);
			font-family: var(--font);
			font-size: 13.5px;
			outline: none;
			transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
		}
		input:focus, select:focus {
			border-color: var(--accent);
			box-shadow: 0 0 0 3px var(--accent-dim), 0 0 12px rgba(0, 150, 199, 0.1);
		}
		input::placeholder { color: var(--text-muted); }
		select { cursor: pointer; -webkit-appearance: none; }
		select option { background: var(--bg-elevated); }

		/* ── Toggle / Checkbox ── */
		.checkbox-row {
			display: flex;
			align-items: center;
			gap: 9px;
			font-size: 13px;
			color: var(--text-secondary);
			margin-bottom: 8px;
			cursor: pointer;
		}
		.checkbox-row input[type="checkbox"] {
			width: 16px; height: 16px;
			accent-color: var(--accent);
			cursor: pointer;
		}

		/* ── Status Indicator ── */
		.status-dot {
			display: inline-block;
			width: 7px; height: 7px;
			border-radius: 50%;
		}
		.status-dot.green {
			background: var(--success);
			box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
		}
		.status-dot.red {
			background: var(--danger);
			box-shadow: 0 0 6px rgba(244, 63, 94, 0.4);
		}
		.status-dot.yellow {
			background: var(--energy);
			box-shadow: 0 0 6px rgba(251, 133, 0, 0.4);
			animation: pulse 2s ease-in-out infinite;
		}

		/* ── Header ── */
		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 16px;
		}
		.header .back {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			background: none;
			border: none;
			color: var(--text-muted);
			cursor: pointer;
			font-family: var(--font);
			font-size: 12.5px;
			font-weight: 500;
			padding: 4px 0;
			transition: color 0.15s;
		}
		.header .back:hover { color: var(--text-primary); }
		.header .back svg { width: 14px; height: 14px; }

		/* ── Alerts ── */
		.alert {
			padding: 10px 14px;
			border-radius: var(--radius);
			font-size: 12.5px;
			margin-bottom: 10px;
			line-height: 1.5;
			display: flex;
			align-items: flex-start;
			gap: 8px;
		}
		.alert-error {
			background: var(--danger-dim);
			color: #fca5a5;
			border: 1px solid rgba(244, 63, 94, 0.2);
		}
		.alert-success {
			background: var(--success-dim);
			color: #86efac;
			border: 1px solid rgba(16, 185, 129, 0.2);
		}
		.alert-info {
			background: var(--accent-dim);
			color: var(--glow);
			border: 1px solid rgba(0, 150, 199, 0.2);
		}

		/* ── Nav Tabs ── */
		.nav {
			display: flex;
			gap: 2px;
			background: var(--bg-surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			padding: 3px;
			margin-bottom: 14px;
		}
		.nav button {
			flex: 1;
			background: none;
			border: none;
			color: var(--text-muted);
			padding: 7px 0;
			font-family: var(--font-display);
			font-size: 12px;
			font-weight: 700;
			cursor: pointer;
			border-radius: 7px;
			transition: all 0.2s var(--ease);
		}
		.nav button.active {
			background: var(--gradient-primary);
			color: #fff;
			box-shadow: 0 1px 6px rgba(0, 150, 199, 0.2);
		}
		.nav button:hover:not(.active) { color: var(--text-secondary); }

		/* ── Provider Badge ── */
		.provider-badge {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			padding: 3px 8px;
			border-radius: 4px;
			font-family: var(--font-display);
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
		}
		.provider-badge.openai { background: rgba(16,163,127,0.12); color: #34d399; }
		.provider-badge.anthropic { background: rgba(217,170,119,0.12); color: #d9aa77; }
		.provider-badge.google { background: rgba(96,165,250,0.12); color: #60a5fa; }
		.provider-badge.mistral { background: rgba(251,133,0,0.12); color: #FB8500; }
		.provider-badge.custom { background: rgba(148,163,184,0.12); color: #94a3b8; }
		.provider-badge.default-tag {
			background: var(--success-dim);
			color: var(--success);
			font-size: 10px;
			padding: 2px 6px;
		}

		/* ── Approval Origin ── */
		.approval-origin {
			font-family: var(--font-mono);
			font-size: 12px;
			color: var(--glow);
			word-break: break-all;
			padding: 6px 8px;
			background: var(--accent-dim);
			border-radius: var(--radius-sm);
			margin-top: 6px;
		}

		/* ── Budget Bar ── */
		.budget-bar {
			height: 6px;
			background: var(--bg-base);
			border-radius: 3px;
			overflow: hidden;
			margin-top: 8px;
		}
		.budget-bar-fill {
			height: 100%;
			border-radius: 3px;
			transition: width 0.5s var(--ease);
			background: var(--gradient-primary);
		}
		.budget-bar-fill.warning {
			background: var(--gradient-energy);
		}
		.budget-bar-fill.danger {
			background: linear-gradient(90deg, var(--danger), #fb7185);
		}

		/* ── Key Card ── */
		.key-card {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}
		.key-card-info { flex: 1; min-width: 0; }
		.key-card-name {
			font-weight: 600;
			font-size: 13.5px;
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.key-card-meta {
			font-family: var(--font-mono);
			font-size: 11.5px;
			color: var(--text-muted);
			margin-top: 3px;
		}

		/* ── App Card ── */
		.app-card-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 8px;
		}

		/* ── Vault Icon / Logo ── */
		.vault-icon {
			width: 48px;
			height: 48px;
			border-radius: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 14px;
			font-size: 24px;
		}
		.vault-icon.locked {
			background: linear-gradient(135deg, var(--bg-elevated), var(--bg-surface));
			border: 1px solid var(--border);
		}
		.vault-icon.unlocked {
			background: linear-gradient(135deg, var(--accent-dim), transparent);
			border: 1px solid rgba(0, 150, 199, 0.2);
		}

		.injinary-logo {
			width: 56px;
			height: 56px;
			object-fit: contain;
			display: block;
			margin: 0 auto 14px;
			filter: drop-shadow(0 0 16px rgba(72, 202, 228, 0.2));
		}

		.injinary-logo-sm {
			width: 24px;
			height: 24px;
			object-fit: contain;
			filter: drop-shadow(0 0 6px rgba(72, 202, 228, 0.15));
		}

		.brand-name {
			font-family: var(--font-display);
			font-weight: 800;
			letter-spacing: 0.02em;
			background: linear-gradient(135deg, var(--glow) 0%, var(--accent) 50%, var(--energy) 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		}

		/* ── Scrollbar ── */
		::-webkit-scrollbar { width: 4px; }
		::-webkit-scrollbar-track { background: transparent; }
		::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

		/* ── Screen transitions ── */
		.screen-enter {
			animation: slideUp 0.3s var(--ease);
		}

		/* ── Divider ── */
		.divider {
			height: 1px;
			background: var(--border);
			margin: 12px 0;
		}
		.divider-text {
			display: flex;
			align-items: center;
			gap: 12px;
			margin: 14px 0;
			color: var(--text-muted);
			font-family: var(--font-display);
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
		}
		.divider-text::before, .divider-text::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--border);
		}

		/* ── Provider Links ── */
		.provider-links {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.provider-link-btn {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			padding: 10px 14px;
			background: var(--bg-surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			cursor: pointer;
			font-family: var(--font);
			transition: all 0.2s var(--ease);
			color: var(--text-secondary);
		}
		.provider-link-btn:hover {
			background: var(--bg-elevated);
			border-color: rgba(72, 202, 228, 0.2);
			color: var(--text-primary);
		}
		.provider-link-btn svg { opacity: 0.4; transition: opacity 0.2s; }
		.provider-link-btn:hover svg { opacity: 0.8; }

		/* ── Empty state ── */
		.empty-state {
			text-align: center;
			padding: 24px 16px;
			color: var(--text-muted);
			font-size: 13px;
		}
		.empty-state svg {
			display: block;
			margin: 0 auto 10px;
			opacity: 0.3;
		}
	`;
	document.head.appendChild(style);
}
