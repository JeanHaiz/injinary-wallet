import { approval, vault } from "../../popup/api.js";
import { renderApproval } from "../../popup/screens/approval.js";
import { renderDashboard } from "../../popup/screens/dashboard.js";
import { renderKeys } from "../../popup/screens/keys.js";
import { renderSetup } from "../../popup/screens/setup.js";
import { renderUnlock } from "../../popup/screens/unlock.js";
import { injectStyles } from "../../popup/styles.js";

injectStyles();

const app = document.getElementById("app")!;

type Screen = "setup" | "unlock" | "dashboard" | "keys" | "approval";

async function navigate(screen?: Screen) {
	if (!screen) {
		// Auto-detect which screen to show
		const initialized = await vault.isInitialized();
		if (!initialized) {
			screen = "setup";
		} else {
			const unlocked = await vault.isUnlocked();
			if (!unlocked) {
				screen = "unlock";
			} else {
				// If there's a pending approval, go straight to it
				const pending = await approval.getPending();
				screen = pending.length > 0 ? "approval" : "dashboard";
			}
		}
	}

	switch (screen) {
		case "setup":
			renderSetup(app, () => navigate("dashboard"));
			break;
		case "unlock":
			renderUnlock(app, () => navigate("dashboard"));
			break;
		case "dashboard":
			renderDashboard(app, (s) => navigate(s));
			break;
		case "keys":
			renderKeys(app, () => navigate("dashboard"));
			break;
		case "approval":
			renderApproval(app, () => navigate("dashboard"));
			break;
	}
}

navigate();
