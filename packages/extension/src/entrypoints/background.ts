import { defineBackground } from "wxt/sandbox";

export default defineBackground(() => {
	// Import the service worker module — this registers all message handlers
	import("../background/service-worker.js");
});
