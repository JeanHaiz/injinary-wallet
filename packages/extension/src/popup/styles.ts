// ─── Shared Styles ───────────────────────────────────────────────────────────
// Injected once into the popup. Keeps all styling in one place.

export function injectStyles() {
	const style = document.createElement("style");
	style.textContent = `
		* { margin: 0; padding: 0; box-sizing: border-box; }

		body {
			width: 380px;
			min-height: 520px;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			background: #09090b;
			color: #e4e4e7;
			font-size: 14px;
			line-height: 1.5;
		}

		#app { padding: 20px; }

		/* ── Typography ── */
		h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
		h2 { font-size: 15px; font-weight: 500; color: #a1a1aa; margin-bottom: 12px; }
		.subtitle { color: #71717a; font-size: 13px; margin-bottom: 20px; }
		.muted { color: #52525b; font-size: 12px; }

		/* ── Cards ── */
		.card {
			background: #18181b;
			border: 1px solid #27272a;
			border-radius: 10px;
			padding: 16px;
			margin-bottom: 12px;
		}

		/* ── Buttons ── */
		.btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			border: none;
			border-radius: 8px;
			padding: 10px 18px;
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			transition: background 0.15s, opacity 0.15s;
			width: 100%;
		}
		.btn:disabled { opacity: 0.4; cursor: not-allowed; }
		.btn-primary { background: #3b82f6; color: white; }
		.btn-primary:hover:not(:disabled) { background: #2563eb; }
		.btn-danger { background: #dc2626; color: white; }
		.btn-danger:hover:not(:disabled) { background: #b91c1c; }
		.btn-ghost { background: transparent; color: #a1a1aa; border: 1px solid #27272a; }
		.btn-ghost:hover:not(:disabled) { background: #18181b; color: #e4e4e7; }
		.btn-sm { padding: 6px 12px; font-size: 12px; width: auto; }

		/* ── Inputs ── */
		.input-group { margin-bottom: 14px; }
		.input-group label {
			display: block;
			font-size: 12px;
			color: #a1a1aa;
			margin-bottom: 4px;
			font-weight: 500;
		}
		input, select {
			width: 100%;
			padding: 10px 12px;
			background: #0f0f12;
			border: 1px solid #27272a;
			border-radius: 8px;
			color: #e4e4e7;
			font-size: 14px;
			outline: none;
			transition: border-color 0.15s;
		}
		input:focus, select:focus { border-color: #3b82f6; }
		input::placeholder { color: #3f3f46; }
		select { cursor: pointer; }
		select option { background: #18181b; }

		/* ── Status ── */
		.status-dot {
			display: inline-block;
			width: 8px; height: 8px;
			border-radius: 50%;
			margin-right: 8px;
		}
		.status-dot.green { background: #22c55e; }
		.status-dot.red { background: #ef4444; }
		.status-dot.yellow { background: #eab308; }

		/* ── Lists ── */
		.list-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 0;
			border-bottom: 1px solid #1e1e22;
		}
		.list-item:last-child { border-bottom: none; }

		/* ── Header bar ── */
		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 16px;
		}
		.header .back {
			background: none;
			border: none;
			color: #71717a;
			cursor: pointer;
			font-size: 13px;
			padding: 4px 0;
		}
		.header .back:hover { color: #e4e4e7; }

		/* ── Alerts ── */
		.alert {
			padding: 10px 14px;
			border-radius: 8px;
			font-size: 13px;
			margin-bottom: 12px;
		}
		.alert-error { background: #2d1215; color: #fca5a5; border: 1px solid #5c1d24; }
		.alert-success { background: #0d2818; color: #86efac; border: 1px solid #1a4d2e; }
		.alert-info { background: #0c1829; color: #93c5fd; border: 1px solid #1e3a5f; }

		/* ── Approval card ── */
		.approval-origin {
			font-family: "SF Mono", Monaco, monospace;
			font-size: 13px;
			color: #60a5fa;
			word-break: break-all;
		}

		/* ── Nav tabs ── */
		.nav {
			display: flex;
			gap: 2px;
			background: #18181b;
			border-radius: 8px;
			padding: 3px;
			margin-bottom: 16px;
		}
		.nav button {
			flex: 1;
			background: none;
			border: none;
			color: #71717a;
			padding: 7px 0;
			font-size: 12px;
			font-weight: 500;
			cursor: pointer;
			border-radius: 6px;
			transition: all 0.15s;
		}
		.nav button.active { background: #27272a; color: #e4e4e7; }
		.nav button:hover:not(.active) { color: #a1a1aa; }

		/* ── Checkbox ── */
		.checkbox-row {
			display: flex; align-items: center; gap: 8px;
			font-size: 13px; color: #a1a1aa; margin-bottom: 10px;
		}
		.checkbox-row input[type="checkbox"] {
			width: 16px; height: 16px; accent-color: #3b82f6;
		}
	`;
	document.head.appendChild(style);
}
