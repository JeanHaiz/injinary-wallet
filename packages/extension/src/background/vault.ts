// ─── Key Vault ───────────────────────────────────────────────────────────────
// Manages encrypted storage of API keys. Keys are encrypted at rest in
// chrome.storage.local and only decrypted in-memory when the wallet is unlocked.

import type { EncryptedBlob, KeyVault, ProviderKey, WalletMetadata } from "@injinary-wallet/shared";
import { DEFAULT_LOCK_TIMEOUT_MINUTES } from "@injinary-wallet/shared";
import {
	decryptWithKey,
	deriveKey,
	encryptWithKey,
	exportKey,
	generateSalt,
	importKey,
} from "./crypto.js";

const STORAGE_KEYS = {
	metadata: "wallet_metadata",
	vault: "wallet_vault",
	vaultSalt: "wallet_vault_salt",
} as const;

const SESSION_KEYS = {
	masterKey: "session_master_key",
	unlockedAt: "session_unlocked_at",
} as const;

/** In-memory state — lost when service worker terminates */
let cachedMasterKey: CryptoKey | null = null;
let cachedVault: KeyVault | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Initialization ──────────────────────────────────────────────────────────

/** Check if a wallet has been created (password set) */
export async function isInitialized(): Promise<boolean> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.metadata);
	return result[STORAGE_KEYS.metadata] != null;
}

/** Create a new wallet with the given password */
export async function initialize(password: string): Promise<void> {
	if (await isInitialized()) {
		throw new Error("Wallet already initialized");
	}

	const salt = generateSalt();
	const masterKey = await deriveKey(password, salt.buffer as ArrayBuffer);

	const emptyVault: KeyVault = { version: 1, keys: [] };
	const { ciphertext, iv } = await encryptWithKey(JSON.stringify(emptyVault), masterKey);

	const metadata: WalletMetadata = {
		version: 1,
		createdAt: Date.now(),
		lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
	};

	await chrome.storage.local.set({
		[STORAGE_KEYS.metadata]: metadata,
		[STORAGE_KEYS.vaultSalt]: bufferToBase64(salt),
		[STORAGE_KEYS.vault]: { ciphertext, iv } satisfies Omit<EncryptedBlob, "salt" | "iterations">,
	});

	// Cache in memory and session
	cachedMasterKey = masterKey;
	cachedVault = emptyVault;
	await cacheKeyInSession(masterKey);
	resetLockTimer(metadata.lockTimeoutMinutes);
}

// ─── Lock / Unlock ───────────────────────────────────────────────────────────

export function isUnlocked(): boolean {
	return cachedMasterKey !== null;
}

/** Unlock the vault with the user's password */
export async function unlock(password: string): Promise<void> {
	const saltB64 = (await chrome.storage.local.get(STORAGE_KEYS.vaultSalt))[
		STORAGE_KEYS.vaultSalt
	] as string;
	if (!saltB64) throw new Error("Wallet not initialized");

	const salt = base64ToBuffer(saltB64);
	const masterKey = await deriveKey(password, salt.buffer as ArrayBuffer);

	// Try to decrypt — will throw if password is wrong
	await loadVault(masterKey);

	cachedMasterKey = masterKey;
	await cacheKeyInSession(masterKey);

	const metadata = await getMetadata();
	resetLockTimer(metadata.lockTimeoutMinutes);
}

/** Lock the vault — clear all in-memory secrets */
export async function lock(): Promise<void> {
	cachedMasterKey = null;
	cachedVault = null;
	if (lockTimer) clearTimeout(lockTimer);
	lockTimer = null;
	await chrome.storage.session.remove([SESSION_KEYS.masterKey, SESSION_KEYS.unlockedAt]);
}

/**
 * Attempt to restore the master key from chrome.storage.session.
 * Called on service worker startup to avoid re-prompting for password.
 */
export async function tryRestoreSession(): Promise<boolean> {
	try {
		const session = await chrome.storage.session.get([
			SESSION_KEYS.masterKey,
			SESSION_KEYS.unlockedAt,
		]);
		const jwk = session[SESSION_KEYS.masterKey] as JsonWebKey | undefined;
		if (!jwk) return false;

		const key = await importKey(jwk);
		// Verify the key works by trying to decrypt the vault
		await loadVault(key);
		cachedMasterKey = key;

		const metadata = await getMetadata();
		resetLockTimer(metadata.lockTimeoutMinutes);
		return true;
	} catch {
		// Session key is stale or invalid
		await chrome.storage.session.remove([SESSION_KEYS.masterKey, SESSION_KEYS.unlockedAt]);
		return false;
	}
}

// ─── Key Management ──────────────────────────────────────────────────────────

/** Get all stored keys (vault must be unlocked) */
export function getKeys(): ProviderKey[] {
	assertUnlocked();
	return [...cachedVault!.keys];
}

/** Get the default key for a provider */
export function getKeyForProvider(provider: string): ProviderKey | undefined {
	assertUnlocked();
	return (
		cachedVault!.keys.find((k) => k.provider === provider && k.isDefault) ??
		cachedVault!.keys.find((k) => k.provider === provider)
	);
}

/** Add a new API key */
export async function addKey(
	key: Omit<ProviderKey, "id" | "addedAt" | "lastUsedAt">,
): Promise<ProviderKey> {
	assertUnlocked();
	const newKey: ProviderKey = {
		...key,
		id: crypto.randomUUID(),
		addedAt: Date.now(),
		lastUsedAt: 0,
	};
	cachedVault!.keys.push(newKey);
	await saveVault();
	return newKey;
}

/** Remove a key by ID */
export async function removeKey(id: string): Promise<void> {
	assertUnlocked();
	cachedVault!.keys = cachedVault!.keys.filter((k) => k.id !== id);
	await saveVault();
}

/** Mark a key as recently used */
export async function touchKey(id: string): Promise<void> {
	assertUnlocked();
	const key = cachedVault!.keys.find((k) => k.id === id);
	if (key) {
		key.lastUsedAt = Date.now();
		await saveVault();
	}
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function assertUnlocked(): void {
	if (!cachedMasterKey || !cachedVault) {
		throw new Error("Wallet is locked");
	}
}

async function getMetadata(): Promise<WalletMetadata> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.metadata);
	return result[STORAGE_KEYS.metadata] as WalletMetadata;
}

async function loadVault(key: CryptoKey): Promise<KeyVault> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.vault);
	const blob = result[STORAGE_KEYS.vault] as { ciphertext: string; iv: string };
	if (!blob) throw new Error("No vault data found");

	const json = await decryptWithKey(blob.ciphertext, blob.iv, key);
	const vault = JSON.parse(json) as KeyVault;
	cachedVault = vault;
	return vault;
}

async function saveVault(): Promise<void> {
	assertUnlocked();
	const json = JSON.stringify(cachedVault);
	const { ciphertext, iv } = await encryptWithKey(json, cachedMasterKey!);
	await chrome.storage.local.set({
		[STORAGE_KEYS.vault]: { ciphertext, iv },
	});
}

async function cacheKeyInSession(key: CryptoKey): Promise<void> {
	const jwk = await exportKey(key);
	await chrome.storage.session.set({
		[SESSION_KEYS.masterKey]: jwk,
		[SESSION_KEYS.unlockedAt]: Date.now(),
	});
}

function resetLockTimer(timeoutMinutes: number): void {
	if (lockTimer) clearTimeout(lockTimer);
	lockTimer = setTimeout(
		() => {
			lock();
		},
		timeoutMinutes * 60 * 1000,
	);
}

function bufferToBase64(buffer: Uint8Array): string {
	let binary = "";
	for (const byte of buffer) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
