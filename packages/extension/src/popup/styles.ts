// ─── Injinary Wallet — Popup Styles ──────────────────────────────────────────
// Forged terracotta on obsidian. Saira Stencil display, Libre Baskerville body.

export function injectStyles() {
	const style = document.createElement("style");
	style.textContent = `
		@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Saira+Stencil:wght@400;500;600;700;800&display=swap');

		:root {
			/* Surfaces (dark-only) */
			--bg-app: #0d1117;
			--bg-surface: #161b22;
			--bg-elevated: #1f262e;
			--bg-hover: #262d36;

			/* Text */
			--text-primary: #e6edf3;
			--text-secondary: #cbd5e1;
			--text-muted: #94a3b8;

			/* Borders */
			--border-subtle: #30363d;
			--border: rgba(243, 119, 77, 0.14);
			--border-focus: #f3774d;

			/* Brand — Injinary Terracotta */
			--injinary-orange: #f3774d;
			--injinary-orange-glow: #ffc691;
			--injinary-orange-burnt: #913d26;
			--injinary-orange-hover: #e26339;

			--accent: var(--injinary-orange);
			--accent-dim: rgba(243, 119, 77, 0.12);
			--accent-glow: rgba(243, 119, 77, 0.20);
			--glow: var(--injinary-orange-glow);
			--energy: var(--injinary-orange);
			--energy-dim: rgba(243, 119, 77, 0.12);

			/* Status */
			--success: #10b981;
			--success-dim: rgba(16, 185, 129, 0.12);
			--warning: #f3774d;
			--warning-dim: rgba(243, 119, 77, 0.12);
			--danger: #f43f5e;
			--danger-dim: rgba(244, 63, 94, 0.10);

			/* Geometry */
			--radius: 10px;
			--radius-sm: 6px;
			--radius-lg: 14px;

			/* Typography */
			--font-display: "Saira Stencil", Impact, system-ui, sans-serif;
			--font-body: "Libre Baskerville", Georgia, "Times New Roman", serif;
			--font-mono: "SF Mono", "JetBrains Mono", "Fira Code", monospace;
			--font: var(--font-body);

			--ease: cubic-bezier(0.16, 1, 0.3, 1);

			/* Gradients */
			--gradient-primary: linear-gradient(135deg, var(--injinary-orange) 0%, var(--injinary-orange-glow) 100%);
			--gradient-burnt: linear-gradient(135deg, var(--injinary-orange-burnt) 0%, var(--injinary-orange) 100%);
			--gradient-energy: linear-gradient(135deg, var(--injinary-orange-burnt) 0%, var(--injinary-orange) 60%, var(--injinary-orange-glow) 100%);
			--gradient-glow: radial-gradient(ellipse 80% 60% at 50% 0%, var(--accent-dim) 0%, transparent 70%);
			--gradient-text: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
		}

		* { margin: 0; padding: 0; box-sizing: border-box; }

		body {
			width: 380px;
			min-height: 520px;
			font-family: var(--font-body);
			background: var(--bg-app);
			color: var(--text-primary);
			font-size: 14px;
			line-height: 1.55;
			-webkit-font-smoothing: antialiased;
		}

		body::before {
			content: '';
			position: fixed;
			inset: 0;
			background:
				radial-gradient(ellipse 90% 60% at 50% -10%, rgba(243, 119, 77, 0.10) 0%, transparent 65%),
				radial-gradient(ellipse 50% 40% at 100% 100%, rgba(145, 61, 38, 0.10) 0%, transparent 70%);
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
			0%, 100% { box-shadow: 0 0 12px rgba(243, 119, 77, 0.18); }
			50% { box-shadow: 0 0 24px rgba(243, 119, 77, 0.30); }
		}

		/* ── Typography ── */
		h1 {
			font-family: var(--font-display);
			font-size: 20px;
			font-weight: 700;
			letter-spacing: 0.02em;
			color: var(--text-primary);
			text-transform: lowercase;
		}
		h2 {
			font-family: var(--font-display);
			font-size: 12px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.10em;
			color: var(--text-muted);
			margin-bottom: 10px;
		}
		h3 {
			font-family: var(--font-display);
			font-size: 14px;
			font-weight: 700;
			letter-spacing: 0.04em;
			color: var(--text-primary);
		}
		.subtitle {
			color: var(--text-secondary);
			font-size: 13px;
			margin-bottom: 20px;
			line-height: 1.6;
			font-style: italic;
		}
		.muted { color: var(--text-muted); font-size: 12px; }
		.mono { font-family: var(--font-mono); font-size: 12px; }

		code {
			background-color: var(--bg-app);
			color: var(--injinary-orange);
			padding: 0.18rem 0.4rem;
			border-radius: 4px;
			font-family: var(--font-mono);
			font-size: 12px;
		}

		/* ── Cards ── */
		.card {
			background: var(--bg-surface);
			border: 1px solid var(--border-subtle);
			border-radius: var(--radius-lg);
			padding: 16px;
			margin-bottom: 10px;
			box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(243, 119, 77, 0.04);
			transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
		}
		.card:hover {
			border-color: rgba(243, 119, 77, 0.22);
			box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(243, 119, 77, 0.10);
		}
		.card-glow {
			background: var(--gradient-glow), var(--bg-surface);
			border-color: rgba(243, 119, 77, 0.30);
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
			letter-spacing: 0.06em;
			text-transform: uppercase;
			cursor: pointer;
			transition: all 0.2s var(--ease);
			width: 100%;
			position: relative;
			overflow: hidden;
		}
		.btn::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%);
			pointer-events: none;
		}
		.btn:active:not(:disabled) { transform: scale(0.98); }
		.btn:disabled { opacity: 0.35; cursor: not-allowed; }

		.btn-primary {
			background: var(--gradient-primary);
			color: #1a1c1e;
			box-shadow: 0 4px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15);
		}
		.btn-primary:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 6px 18px rgba(243, 119, 77, 0.35), inset 0 1px 0 rgba(255,255,255,0.18);
			filter: brightness(1.05);
		}

		.btn-danger {
			background: var(--danger);
			color: #fff;
			box-shadow: 0 1px 3px rgba(0,0,0,0.4);
		}
		.btn-danger:hover:not(:disabled) { background: #e11d48; }

		.btn-ghost {
			background: rgba(243, 119, 77, 0.06);
			color: var(--text-secondary);
			border: 1px solid var(--border-subtle);
		}
		.btn-ghost:hover:not(:disabled) {
			background: rgba(243, 119, 77, 0.12);
			color: var(--text-primary);
			border-color: rgba(243, 119, 77, 0.30);
		}

		.btn-sm {
			padding: 5px 12px;
			font-size: 11px;
			letter-spacing: 0.05em;
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
			letter-spacing: 0.10em;
			color: var(--text-muted);
			margin-bottom: 5px;
		}
		input, select {
			width: 100%;
			padding: 10px 12px;
			background: var(--bg-elevated);
			border: 1px solid var(--border-subtle);
			border-radius: var(--radius);
			color: var(--text-primary);
			font-family: var(--font-body);
			font-size: 13.5px;
			outline: none;
			transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
		}
		input:focus, select:focus {
			border-color: var(--injinary-orange);
			box-shadow: 0 0 0 3px var(--accent-dim), 0 0 12px rgba(243, 119, 77, 0.15);
		}
		input::placeholder { color: var(--text-muted); font-style: italic; }
		select { cursor: pointer; -webkit-appearance: none; }
		select option { background: var(--bg-elevated); color: var(--text-primary); }

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
			accent-color: var(--injinary-orange);
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
			box-shadow: 0 0 6px rgba(16, 185, 129, 0.45);
		}
		.status-dot.red {
			background: var(--danger);
			box-shadow: 0 0 6px rgba(244, 63, 94, 0.45);
		}
		.status-dot.yellow {
			background: var(--injinary-orange);
			box-shadow: 0 0 6px rgba(243, 119, 77, 0.55);
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
			font-family: var(--font-body);
			font-size: 12.5px;
			font-weight: 400;
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
			border: 1px solid rgba(244, 63, 94, 0.22);
		}
		.alert-success {
			background: var(--success-dim);
			color: #86efac;
			border: 1px solid rgba(16, 185, 129, 0.22);
		}
		.alert-info {
			background: var(--accent-dim);
			color: var(--injinary-orange-glow);
			border: 1px solid rgba(243, 119, 77, 0.22);
		}

		/* ── Nav Tabs ── */
		.nav {
			display: flex;
			gap: 2px;
			background: var(--bg-surface);
			border: 1px solid var(--border-subtle);
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
			letter-spacing: 0.08em;
			text-transform: uppercase;
			cursor: pointer;
			border-radius: 7px;
			transition: all 0.2s var(--ease);
		}
		.nav button.active {
			background: var(--gradient-primary);
			color: #1a1c1e;
			box-shadow: 0 2px 8px var(--accent-glow);
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
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}
		.provider-badge.openai { background: rgba(16,163,127,0.14); color: #34d399; }
		.provider-badge.anthropic { background: rgba(243, 119, 77, 0.14); color: var(--injinary-orange-glow); }
		.provider-badge.google { background: rgba(96,165,250,0.14); color: #60a5fa; }
		.provider-badge.mistral { background: rgba(167,139,250,0.14); color: #a78bfa; }
		.provider-badge.custom { background: rgba(148,163,184,0.14); color: #94a3b8; }
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
			color: var(--injinary-orange-glow);
			word-break: break-all;
			padding: 6px 8px;
			background: var(--accent-dim);
			border: 1px solid rgba(243, 119, 77, 0.18);
			border-radius: var(--radius-sm);
			margin-top: 6px;
		}

		/* ── Budget Bar ── */
		.budget-bar {
			height: 6px;
			background: var(--bg-app);
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
			font-family: var(--font-display);
			font-weight: 700;
			font-size: 13.5px;
			letter-spacing: 0.02em;
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
			border: 1px solid var(--border-subtle);
		}
		.vault-icon.unlocked {
			background: linear-gradient(135deg, var(--accent-dim), transparent);
			border: 1px solid rgba(243, 119, 77, 0.30);
		}

		.injinary-logo {
			width: 64px;
			height: 64px;
			object-fit: contain;
			display: block;
			margin: 0 auto 14px;
			filter: drop-shadow(0 0 16px rgba(243, 119, 77, 0.35));
		}

		.injinary-logo-sm {
			width: 26px;
			height: 26px;
			object-fit: contain;
			filter: drop-shadow(0 0 6px rgba(243, 119, 77, 0.25));
		}

		.injinary-logo-wordmark {
			display: block;
			margin: 8px auto 18px;
			width: 220px;
			max-width: 80%;
			height: auto;
			filter: drop-shadow(0 0 18px rgba(243, 119, 77, 0.20));
		}

		.brand-name {
			font-family: var(--font-display);
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: lowercase;
			background: var(--gradient-text);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		}

		.shield-glow {
			filter: drop-shadow(0 0 8px var(--accent-glow));
		}

		/* ── Scrollbar ── */
		::-webkit-scrollbar { width: 4px; }
		::-webkit-scrollbar-track { background: transparent; }
		::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }
		::-webkit-scrollbar-thumb:hover { background: rgba(243, 119, 77, 0.30); }

		/* ── Screen transitions ── */
		.screen-enter {
			animation: slideUp 0.3s var(--ease);
		}

		/* ── Divider ── */
		.divider {
			height: 1px;
			background: var(--border-subtle);
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
			letter-spacing: 0.10em;
		}
		.divider-text::before, .divider-text::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--border-subtle);
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
			border: 1px solid var(--border-subtle);
			border-radius: var(--radius);
			cursor: pointer;
			font-family: var(--font-body);
			transition: all 0.2s var(--ease);
			color: var(--text-secondary);
		}
		.provider-link-btn:hover {
			background: var(--bg-elevated);
			border-color: rgba(243, 119, 77, 0.28);
			color: var(--text-primary);
		}
		.provider-link-btn svg { opacity: 0.45; transition: opacity 0.2s; }
		.provider-link-btn:hover svg { opacity: 0.85; }

		/* ── Empty state ── */
		.empty-state {
			text-align: center;
			padding: 24px 16px;
			color: var(--text-muted);
			font-size: 13px;
			font-style: italic;
		}
		.empty-state svg {
			display: block;
			margin: 0 auto 10px;
			opacity: 0.35;
			color: var(--injinary-orange-burnt);
		}

		/* ── Wallet Popup wrapper (brand alias) ── */
		.wallet-popup {
			width: 320px;
			background: var(--bg-surface);
			color: var(--text-primary);
			border-radius: 16px;
			overflow: hidden;
		}
	`;
	document.head.appendChild(style);
}
