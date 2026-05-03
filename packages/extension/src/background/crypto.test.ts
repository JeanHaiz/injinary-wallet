import { describe, expect, it } from "vitest";
import {
	decrypt,
	decryptWithKey,
	deriveKey,
	encrypt,
	encryptWithKey,
	exportKey,
	generateSalt,
	importKey,
} from "./crypto.js";

describe("crypto", () => {
	const PASSWORD = "test-password-123!";

	describe("deriveKey", () => {
		it("derives a CryptoKey from password and salt", async () => {
			const salt = generateSalt();
			const key = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);
			expect(key).toBeInstanceOf(CryptoKey);
			expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
			expect(key.usages).toContain("encrypt");
			expect(key.usages).toContain("decrypt");
		});

		it("derives different keys for different passwords", async () => {
			const salt = generateSalt();
			const key1 = await deriveKey("password-a", salt.buffer as ArrayBuffer);
			const key2 = await deriveKey("password-b", salt.buffer as ArrayBuffer);
			const jwk1 = await exportKey(key1);
			const jwk2 = await exportKey(key2);
			expect(jwk1.k).not.toBe(jwk2.k);
		});

		it("derives different keys for different salts", async () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			const key1 = await deriveKey(PASSWORD, salt1.buffer as ArrayBuffer);
			const key2 = await deriveKey(PASSWORD, salt2.buffer as ArrayBuffer);
			const jwk1 = await exportKey(key1);
			const jwk2 = await exportKey(key2);
			expect(jwk1.k).not.toBe(jwk2.k);
		});

		it("is deterministic for same password and salt", async () => {
			const salt = generateSalt();
			const key1 = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);
			const key2 = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);
			const jwk1 = await exportKey(key1);
			const jwk2 = await exportKey(key2);
			expect(jwk1.k).toBe(jwk2.k);
		});
	});

	describe("encrypt / decrypt round-trip", () => {
		it("encrypts and decrypts back to the original plaintext", async () => {
			const plaintext = "Hello, world! 🔐";
			const { ciphertext, salt, iv } = await encrypt(plaintext, PASSWORD);
			const decrypted = await decrypt(ciphertext, salt, iv, PASSWORD);
			expect(decrypted).toBe(plaintext);
		});

		it("works with empty string", async () => {
			const plaintext = "";
			const { ciphertext, salt, iv } = await encrypt(plaintext, PASSWORD);
			const decrypted = await decrypt(ciphertext, salt, iv, PASSWORD);
			expect(decrypted).toBe(plaintext);
		});

		it("works with large payloads", async () => {
			const plaintext = "A".repeat(100_000);
			const { ciphertext, salt, iv } = await encrypt(plaintext, PASSWORD);
			const decrypted = await decrypt(ciphertext, salt, iv, PASSWORD);
			expect(decrypted).toBe(plaintext);
		});

		it("produces different ciphertext each time (random IV/salt)", async () => {
			const plaintext = "same input";
			const result1 = await encrypt(plaintext, PASSWORD);
			const result2 = await encrypt(plaintext, PASSWORD);
			expect(result1.ciphertext).not.toBe(result2.ciphertext);
			expect(result1.salt).not.toBe(result2.salt);
			expect(result1.iv).not.toBe(result2.iv);
		});

		it("fails to decrypt with wrong password", async () => {
			const { ciphertext, salt, iv } = await encrypt("secret", PASSWORD);
			await expect(decrypt(ciphertext, salt, iv, "wrong-password")).rejects.toThrow();
		});

		it("fails to decrypt with tampered ciphertext", async () => {
			const { ciphertext, salt, iv } = await encrypt("secret", PASSWORD);
			// Flip a character in the base64 ciphertext
			const tampered = `${ciphertext.slice(0, -2)}AA`;
			await expect(decrypt(tampered, salt, iv, PASSWORD)).rejects.toThrow();
		});

		it("fails to decrypt with tampered IV", async () => {
			const { ciphertext, salt, iv } = await encrypt("secret", PASSWORD);
			const tampered = `${iv.slice(0, -2)}AA`;
			await expect(decrypt(ciphertext, salt, tampered, PASSWORD)).rejects.toThrow();
		});
	});

	describe("encryptWithKey / decryptWithKey round-trip", () => {
		it("encrypts and decrypts with a pre-derived key", async () => {
			const salt = generateSalt();
			const key = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);

			const plaintext = "vault data: {keys: []}";
			const { ciphertext, iv } = await encryptWithKey(plaintext, key);
			const decrypted = await decryptWithKey(ciphertext, iv, key);
			expect(decrypted).toBe(plaintext);
		});

		it("fails with a different key", async () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			const key1 = await deriveKey(PASSWORD, salt1.buffer as ArrayBuffer);
			const key2 = await deriveKey(PASSWORD, salt2.buffer as ArrayBuffer);

			const { ciphertext, iv } = await encryptWithKey("secret", key1);
			await expect(decryptWithKey(ciphertext, iv, key2)).rejects.toThrow();
		});
	});

	describe("exportKey / importKey round-trip", () => {
		it("exports and re-imports a key that still works", async () => {
			const salt = generateSalt();
			const originalKey = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);

			const plaintext = "session persistence test";
			const { ciphertext, iv } = await encryptWithKey(plaintext, originalKey);

			const jwk = await exportKey(originalKey);
			const restoredKey = await importKey(jwk);

			const decrypted = await decryptWithKey(ciphertext, iv, restoredKey);
			expect(decrypted).toBe(plaintext);
		});

		it("exported JWK contains expected fields", async () => {
			const salt = generateSalt();
			const key = await deriveKey(PASSWORD, salt.buffer as ArrayBuffer);
			const jwk = await exportKey(key);
			expect(jwk.kty).toBe("oct");
			expect(jwk.alg).toBe("A256GCM");
			expect(jwk.k).toBeDefined();
			expect(typeof jwk.k).toBe("string");
		});
	});

	describe("generateSalt", () => {
		it("returns 32 bytes", () => {
			const salt = generateSalt();
			expect(salt).toBeInstanceOf(Uint8Array);
			expect(salt.length).toBe(32);
		});

		it("produces unique values", () => {
			const a = generateSalt();
			const b = generateSalt();
			expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
		});
	});
});
