// ─── Web Crypto API Wrappers ─────────────────────────────────────────────────
// Zero dependencies. All cryptographic operations use the native Web Crypto API.

import { PBKDF2_ITERATIONS } from "@ai-wallet/shared";

const ALGORITHM = "AES-GCM" as const;
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM
const SALT_LENGTH = 32;

/** Derive an AES-256-GCM key from a user password using PBKDF2 */
export async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: ALGORITHM, length: KEY_LENGTH },
		true, // extractable — needed to export to JWK for session storage
		["encrypt", "decrypt"],
	);
}

/** Encrypt plaintext with AES-256-GCM. Returns ciphertext, salt, and IV as base64. */
export async function encrypt(
	plaintext: string,
	password: string,
): Promise<{ ciphertext: string; salt: string; iv: string }> {
	const encoder = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const key = await deriveKey(password, salt.buffer as ArrayBuffer);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
		key,
		encoder.encode(plaintext),
	);

	return {
		ciphertext: bufferToBase64(ciphertext),
		salt: bufferToBase64(salt),
		iv: bufferToBase64(iv),
	};
}

/** Decrypt AES-256-GCM ciphertext. Throws if password is wrong. */
export async function decrypt(
	ciphertextB64: string,
	saltB64: string,
	ivB64: string,
	password: string,
): Promise<string> {
	const salt = base64ToBuffer(saltB64);
	const iv = base64ToBuffer(ivB64);
	const ciphertext = base64ToBuffer(ciphertextB64);
	const key = await deriveKey(password, salt.buffer as ArrayBuffer);

	const plaintext = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
		key,
		ciphertext.buffer as ArrayBuffer,
	);

	return new TextDecoder().decode(plaintext);
}

/** Export a CryptoKey to JWK for storage in chrome.storage.session */
export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
	return crypto.subtle.exportKey("jwk", key);
}

/** Import a JWK back into a CryptoKey */
export async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
	return crypto.subtle.importKey("jwk", jwk, { name: ALGORITHM, length: KEY_LENGTH }, true, [
		"encrypt",
		"decrypt",
	]);
}

/** Encrypt using an already-derived CryptoKey (for vault operations after unlock) */
export async function encryptWithKey(
	plaintext: string,
	key: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
	const encoder = new TextEncoder();
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
		key,
		encoder.encode(plaintext),
	);

	return {
		ciphertext: bufferToBase64(ciphertext),
		iv: bufferToBase64(iv),
	};
}

/** Decrypt using an already-derived CryptoKey */
export async function decryptWithKey(
	ciphertextB64: string,
	ivB64: string,
	key: CryptoKey,
): Promise<string> {
	const iv = base64ToBuffer(ivB64);
	const ciphertext = base64ToBuffer(ciphertextB64);

	const plaintext = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
		key,
		ciphertext.buffer as ArrayBuffer,
	);

	return new TextDecoder().decode(plaintext);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) {
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

/** Generate a random salt */
export function generateSalt(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
