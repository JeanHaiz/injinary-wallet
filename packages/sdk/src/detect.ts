import type { WalletInfo } from "@injinary-wallet/shared";
import { sendRpc } from "./transport.js";

/**
 * Check if the Injinary Wallet extension is installed and available.
 * Returns wallet info if found, null otherwise.
 */
export async function detect(timeoutMs = 500): Promise<WalletInfo | null> {
	try {
		const result = await sendRpc<undefined, WalletInfo>("ai_detectWallet", undefined, timeoutMs);
		return result;
	} catch {
		return null;
	}
}

/** Returns true if the wallet is available */
export async function isAvailable(timeoutMs = 500): Promise<boolean> {
	return (await detect(timeoutMs)) !== null;
}
