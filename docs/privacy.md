---
title: Privacy Policy
---

# Privacy Policy

**Effective date:** 3 May 2026
**Last updated:** 3 May 2026

This Privacy Policy describes how the **Injinary Wallet** browser extension ("Injinary", "we", "our", or "the extension") handles your information. The summary, in one sentence: **we do not collect, store, or transmit any of your personal data to our servers, because we do not operate servers**. Everything happens locally in your browser.

This policy is written for users worldwide and aims to satisfy the transparency requirements of the EU General Data Protection Regulation (GDPR) as well as comparable frameworks elsewhere.

---

## 1. Who is the data controller?

The Injinary Wallet extension is a free, open-source project maintained by an individual developer.

- **Maintainer contact:** injinary@gmail.com
- **Source code:** [github.com/JeanHaiz/injinary-wallet](https://github.com/JeanHaiz/injinary-wallet)

Because we operate no servers and collect no personal data, there is no central "data controller" in the GDPR sense for any data the extension handles — your browser is the only place your data exists. The maintainer is nonetheless reachable at the address above for any privacy-related question.

---

## 2. What data does Injinary handle, and where does it live?

Injinary stores the following information **locally in your browser**, using the standard browser storage APIs (`chrome.storage`):

| Data | Purpose | Storage |
| --- | --- | --- |
| Encrypted API keys | Authenticate requests to AI providers on your behalf | Encrypted with AES-256-GCM, key derived from your password via PBKDF2 (600,000 iterations) |
| App permissions | Remember which web apps you have authorised, and what they can do | Plain (non-sensitive) local storage |
| Budget and rate-limit settings | Enforce per-app spending and request limits | Plain local storage |
| Usage history | Show you which apps used your keys and how much they spent | Plain local storage |
| Master key (in memory) | Decrypt API keys during a session | Memory only — discarded on lock or after a configurable timeout (default 15 minutes) |

**None of this data is ever sent to a server we operate.** We do not have analytics, telemetry, crash reporting, or any other call-home behaviour. The extension does not contain tracking pixels, advertising identifiers, or third-party SDKs.

You can inspect or delete all of this data at any time by:

- Locking the wallet (clears the master key from memory),
- Removing the extension (deletes all extension storage), or
- Clearing extension data via `chrome://extensions` → Details → "Site settings" / "Clear data".

---

## 3. What about the AI requests themselves?

When you authorise a web application to use Injinary, that application can ask the extension to forward AI completion requests **to the AI provider whose key you have stored** (e.g. an LLM provider you signed up with separately).

- The request — which contains your prompt, the conversation history, and any other content the application supplies — is sent **directly from your browser to the AI provider's API**, using your decrypted key.
- The request **does not pass through any Injinary-controlled server**. It travels from your machine to your chosen provider.
- The AI provider then handles the request according to **their own privacy policy and terms of service**, which you accepted when you obtained the API key.

What this means in practice: Injinary's role is the role of a key-holder and policy-enforcer — it does not see the contents of your prompts or responses for any purpose beyond logging metadata you can review (timestamps, byte counts, costs) in your own local usage history.

We strongly recommend reading the privacy documentation of the AI provider(s) you use, since they — not Injinary — receive and process the contents of your prompts.

---

## 4. Legal basis (GDPR Art. 6)

To the extent that any local processing in your browser falls under the GDPR:

- **Performance of a contract** (Art. 6(1)(b)): we process your locally-stored configuration in order to deliver the functionality you installed the extension for.
- **Consent** (Art. 6(1)(a)): each time you grant a web application permission to use a key, you provide explicit, revocable consent for that specific app.

You can withdraw consent at any time by revoking an app's permission inside the extension popup, or by removing the extension entirely.

---

## 5. International data transfers

Injinary itself transfers no data internationally (because it transfers no data anywhere). API requests you initiate go directly from your browser to your chosen AI provider — that transfer is governed by the provider's terms, not by Injinary.

---

## 6. Your rights

Because Injinary never receives or stores your personal data, the rights granted by GDPR (access, rectification, erasure, portability, restriction, objection, and the right to lodge a complaint with a supervisory authority) are largely satisfied by your direct control over your browser:

- **Access / portability:** all your data lives in your browser's extension storage and is yours to inspect.
- **Erasure:** uninstall the extension or clear its data; nothing remains on any external system.
- **Rectification / restriction / objection:** edit, lock, or remove keys, apps, and budgets directly in the extension.

If you nonetheless wish to exercise any GDPR right against the maintainer, write to **injinary@gmail.com**. You also have the right to lodge a complaint with your national data protection authority.

---

## 7. Security

- API keys are encrypted at rest using AES-256-GCM with a key derived from your password via PBKDF2 (600,000 iterations of SHA-256).
- The master key exists only in memory while the wallet is unlocked, and is purged on lock or after the inactivity timeout.
- Content scripts run in an isolated world; the page cannot intercept extension messages.
- The exposed `window.injinaryWallet` object is frozen and non-configurable to prevent tampering.
- Budget enforcement happens inside the extension's service worker, not in the page — apps cannot bypass it.

No security control is perfect. If you discover a vulnerability, please report it privately to **injinary@gmail.com** before disclosing publicly.

---

## 8. Children

Injinary is not directed at children under the age of 16, and the AI providers it integrates with typically have their own age restrictions. Do not use the extension on behalf of a child under 16 without verifiable parental consent.

---

## 9. Changes to this policy

We may update this policy when functionality changes or when legal requirements evolve. The "Last updated" date at the top of this document will reflect any such change. Material changes will be highlighted in the project's release notes. Continued use of the extension after a change constitutes acceptance of the updated policy.

---

## 10. Contact

For any question, request, or complaint about this Privacy Policy or your data:

**injinary@gmail.com**

Source code: [github.com/JeanHaiz/injinary-wallet](https://github.com/JeanHaiz/injinary-wallet)
