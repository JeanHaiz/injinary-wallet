# Injinary Wallet — Mobile App Template (Custom URL Scheme)

## Overview

This document describes how Injinary Wallet can be built as a mobile app on iOS and Android, using **Custom URL Schemes / Deep Links** to provide the same secure AI key management to third-party mobile apps. The flow is modeled after OAuth 2.0: a requesting app redirects to Injinary, the user approves, and Injinary calls the AI provider and returns the result — API keys never leave the wallet.

---

## How It Works (High-Level)

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Third-Party  │  1. URL │   Injinary Wallet   │  3. API │  AI Provider  │
│   Mobile App  │───────→│    Mobile App      │───────→│  (OpenAI /    │
│               │        │                    │        │   Anthropic)  │
│               │←───────│  2. User approves  │←───────│              │
│  4. Callback  │        │     & proxies      │        │  Response     │
└──────────────┘         └──────────────────┘         └──────────────┘
```

1. Third-party app opens Injinary via a URL scheme with a JSON payload
2. Injinary Wallet opens, shows the user what's being requested, user approves
3. Injinary decrypts the relevant API key, calls the AI provider
4. Injinary redirects back to the calling app's callback URL with the result

---

## URL Scheme Definitions

### Base Scheme

| Platform | Scheme | Example |
|----------|--------|---------|
| iOS | `injinary://` | `injinary://request?...` |
| Android | `injinary://` | `injinary://request?...` |
| Universal Link (iOS) | `https://injinary.app/wallet/` | For apps that prefer https links |
| App Link (Android) | `https://injinary.app/wallet/` | For apps that prefer verified links |

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `injinary://detect` | Check if wallet is installed, get version & capabilities |
| `injinary://connect` | Request access / permissions for an app |
| `injinary://complete` | Request a chat completion |
| `injinary://embed` | Request text embeddings |
| `injinary://models` | List available models |
| `injinary://budget` | Query remaining budget |
| `injinary://revoke` | Revoke app access |

---

## Request Format

All requests are passed as a **Base64url-encoded JSON** payload in the `payload` query parameter, plus a `callback` parameter for the return URL.

```
injinary://complete?payload=<base64url-json>&callback=<base64url-callback>&nonce=<random>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `payload` | Yes | Base64url-encoded JSON body (see below) |
| `callback` | Yes | Base64url-encoded callback URL of the calling app |
| `nonce` | Yes | Random string to match request with response |
| `sig` | No | HMAC signature for apps with pre-shared session keys |

### Payload JSON Structure

**`injinary://connect`**
```json
{
  "appName": "MyAIApp",
  "appIcon": "https://myapp.com/icon.png",
  "bundleId": "com.myapp.ai",
  "requestedProviders": ["openai", "anthropic"],
  "requestedModels": ["gpt-4o", "claude-sonnet-4-20250514"],
  "requestedBudget": {
    "amount": 500,
    "period": "monthly"
  }
}
```

**`injinary://complete`**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain quantum computing." }
  ],
  "temperature": 0.7,
  "maxTokens": 1024
}
```

**`injinary://embed`**
```json
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "input": ["Hello world", "Another sentence"]
}
```

**`injinary://models`**
```json
{
  "provider": "openai"
}
```

**`injinary://budget`**
```json
{}
```

---

## Response Format

Injinary redirects back to the calling app's callback URL with a Base64url-encoded JSON result.

```
myapp://injinary-callback?result=<base64url-json>&nonce=<original-nonce>&status=ok
```

| Parameter | Description |
|-----------|-------------|
| `result` | Base64url-encoded JSON response body |
| `nonce` | Same nonce from the request (for matching) |
| `status` | `ok` or `error` |
| `error_code` | Present if `status=error`. See error codes below |

### Response JSON Bodies

**Connect Response**
```json
{
  "origin": "com.myapp.ai",
  "allowedProviders": ["openai"],
  "allowedModels": ["gpt-4o"],
  "budgetRemaining": 500,
  "budgetLimit": 500,
  "budgetPeriod": "monthly",
  "autoApprove": true,
  "sessionToken": "tok_abc123..."
}
```

The `sessionToken` is issued on connect and must be included in subsequent requests (in the payload JSON) to avoid re-prompting the user each time.

**Completion Response**
```json
{
  "id": "cmpl_abc123",
  "provider": "openai",
  "model": "gpt-4o",
  "content": "Quantum computing uses qubits...",
  "usage": {
    "promptTokens": 25,
    "completionTokens": 150,
    "totalTokens": 175,
    "estimatedCostCents": 2
  },
  "finishReason": "stop"
}
```

**Embed Response**
```json
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "embeddings": [[0.012, -0.034, ...], [0.056, 0.078, ...]],
  "usage": {
    "totalTokens": 8,
    "estimatedCostCents": 0
  }
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 4001 | WalletLocked | User hasn't unlocked the wallet |
| 4002 | PermissionDenied | App doesn't have permission for this action |
| 4003 | BudgetExceeded | Spending limit reached |
| 4004 | RateLimited | Too many requests |
| 4005 | ProviderError | Upstream AI provider returned an error |
| 4100 | UserRejected | User denied the request in the approval screen |
| 4200 | NotConnected | App hasn't called `connect` yet or session expired |

---

## Complete Flow: First-Time Connection + Request

```
Third-Party App                    Injinary Wallet                    AI Provider
      │                                  │                              │
      │  1. injinary://connect             │                              │
      │  payload={appName,budget,...}     │                              │
      │  callback=myapp://injinary-cb      │                              │
      │─────────────────────────────────→│                              │
      │                                  │                              │
      │                           2. App opens                          │
      │                              Shows approval screen:             │
      │                              "MyAIApp wants to use              │
      │                               OpenAI with $5/mo budget"        │
      │                              [Approve] [Deny]                  │
      │                                  │                              │
      │  3. myapp://injinary-cb            │                              │
      │  result={sessionToken,...}       │                              │
      │←─────────────────────────────────│                              │
      │                                  │                              │
      │  4. injinary://complete            │                              │
      │  payload={sessionToken,          │                              │
      │    messages,...}                  │                              │
      │─────────────────────────────────→│                              │
      │                                  │  5. POST /v1/chat/completions│
      │                                  │─────────────────────────────→│
      │                                  │                              │
      │                                  │  6. Response                 │
      │                                  │←─────────────────────────────│
      │  7. myapp://injinary-cb            │                              │
      │  result={content,usage,...}      │                              │
      │←─────────────────────────────────│                              │
      │                                  │                              │
```

### Subsequent Requests (Auto-Approve Enabled)

When `autoApprove` is granted and the request cost is below the threshold, Injinary processes the request without showing any UI — the user sees a brief app switch and return.

```
Third-Party App                    Injinary Wallet
      │                                  │
      │  injinary://complete               │
      │  payload={sessionToken,...}       │
      │─────────────────────────────────→│
      │                                  │  (no UI shown)
      │                                  │  - verify session
      │                                  │  - check budget
      │                                  │  - call provider
      │  myapp://injinary-cb               │
      │  result={...}                    │
      │←─────────────────────────────────│
```

---

## Platform Implementation Details

### iOS

| Concern | Approach |
|---------|----------|
| URL Scheme registration | `CFBundleURLTypes` in `Info.plist` with scheme `injinary` |
| Universal Links | Apple App Site Association file at `https://injinary.app/.well-known/apple-app-site-association` |
| Handling incoming URLs | `UIApplicationDelegate.application(_:open:options:)` or SwiftUI `.onOpenURL` |
| Returning to caller | `UIApplication.shared.open(callbackURL)` |
| Background processing | Request a background task (`BGTaskRequest`) if provider calls may take >5s |
| Keychain storage | Encrypted vault stored in iOS Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` |
| Biometric unlock | Face ID / Touch ID via `LAContext` as alternative to password |

### Android

| Concern | Approach |
|---------|----------|
| URL Scheme registration | `<intent-filter>` with `<data android:scheme="injinary" />` in `AndroidManifest.xml` |
| App Links | Digital Asset Links file at `https://injinary.app/.well-known/assetlinks.json` |
| Handling incoming URLs | `Activity.intent.data` in a dedicated `DeepLinkActivity` |
| Returning to caller | `startActivity(Intent(Intent.ACTION_VIEW, callbackUri))` |
| Encrypted storage | Android Keystore + EncryptedSharedPreferences (Jetpack Security) |
| Biometric unlock | BiometricPrompt API for fingerprint / face unlock |

---

## Session Token Mechanism

After a successful `connect`, Injinary issues a **session token** that the calling app includes in subsequent requests. This avoids re-prompting the user for every AI call.

| Property | Value |
|----------|-------|
| Format | Opaque string (e.g., `tok_` + 32 random bytes, hex-encoded) |
| Storage | Injinary stores `{ token, bundleId, permissions, createdAt, expiresAt }` |
| Expiry | Configurable; default 24 hours or until wallet locks |
| Validation | On each request: token exists, not expired, bundleId matches caller, budget not exceeded |
| Revocation | User can revoke from wallet UI; app can call `injinary://revoke` |

---

## Security Considerations

### Caller Verification

| Threat | Mitigation |
|--------|------------|
| Spoofed callback URL | On iOS: verify source app via `UIApplication.open` sourceApplication. On Android: use `getCallingPackage()` or require App Links |
| Replay attacks | Nonce must be unique per request; Injinary rejects duplicate nonces within a time window |
| Token theft | Session tokens are bound to the calling app's bundle ID; useless from another app |
| Man-in-the-middle | Use Universal Links / App Links (HTTPS) instead of custom schemes when possible |
| Payload tampering | Optional HMAC signature (`sig` parameter) using a shared secret established during `connect` |

### Data at Rest

| Concern | Approach |
|---------|----------|
| API key storage | Encrypted with AES-256-GCM, key derived via PBKDF2 (600k iterations) from user password |
| Platform integration | iOS Keychain / Android Keystore for master key material |
| Biometric bypass | Biometrics unlock a hardware-backed key that decrypts the vault — password never stored |

### URL Length Limits

Large payloads (long conversations) may exceed URL length limits (~2KB on some Android versions). Mitigations:

1. **Clipboard transfer**: For payloads >1KB, the calling app writes the payload to the system clipboard and sends `injinary://complete?source=clipboard&nonce=...`
2. **Shared file**: The calling app writes payload to a shared App Group container (iOS) or content provider (Android), passes a reference URI
3. **Pagination**: For long conversations, send only the last N messages and a conversation summary

---

## Mapping to Browser Extension RPC Methods

| Extension RPC Method | Mobile URL Endpoint | Notes |
|---------------------|---------------------|-------|
| `ai_detectWallet` | `injinary://detect` | Returns version and capabilities; can also check via `UIApplication.canOpenURL` / `PackageManager.resolveActivity` |
| `ai_requestAccess` | `injinary://connect` | Opens approval screen, returns session token |
| `ai_revokeAccess` | `injinary://revoke` | Clears session and permissions for the calling app |
| `ai_getPermissions` | `injinary://connect` (re-call) | Returns current permission summary without re-prompting if session is valid |
| `ai_complete` | `injinary://complete` | Chat completion, requires session token |
| `ai_completeStream` | N/A | Streaming not supported via URL scheme (see alternatives below) |
| `ai_embed` | `injinary://embed` | Text embeddings, requires session token |
| `ai_listModels` | `injinary://models` | Returns available models for the user's stored providers |
| `ai_getBudget` | `injinary://budget` | Returns budget status |
| `ai_getUsage` | `injinary://budget` | Combined with budget endpoint |

### Streaming Alternative

URL schemes are request-response only — no streaming. Options for long-running completions:

1. **Polling**: Injinary returns a `requestId` immediately; the calling app polls `injinary://status?requestId=...` until complete
2. **Local WebSocket**: Injinary runs a localhost WebSocket server on a random port; the calling app connects for streaming
3. **Notification**: Injinary sends a local push notification when the result is ready; tapping it returns to the calling app with the result

---

## Wallet App Screens (Mobile)

| Screen | Purpose |
|--------|---------|
| **Setup** | First launch — create password, optional biometric enrollment |
| **Unlock** | Password or biometric prompt to decrypt vault |
| **Dashboard** | Usage summary, connected apps, spending overview |
| **Keys** | Add / remove / view API keys per provider |
| **Approval** | Shown when a third-party app requests access or makes a non-auto-approved request |
| **Settings** | Lock timeout, biometrics toggle, budget defaults, data export/import |
| **App Permissions** | Per-app permission management — revoke, adjust budget, change allowed models |

---

## SDK for Mobile Developers

Third-party apps would integrate via a lightweight SDK (Swift Package / Kotlin library) that abstracts the URL scheme:

```
// Conceptual API (pseudocode)

let wallet = InjinaryWallet()

// Check if installed
if wallet.isInstalled() {

    // Connect
    let session = await wallet.connect(
        appName: "MyApp",
        providers: [.openai],
        budget: Budget(amount: 500, period: .monthly)
    )

    // Make a request
    let response = await wallet.complete(
        session: session,
        messages: [
            Message(role: .user, content: "Hello")
        ],
        model: "gpt-4o"
    )

    print(response.content)
}
```

The SDK handles:
- Base64 encoding/decoding of payloads
- Nonce generation and response matching
- Callback URL registration
- Session token storage
- Error code mapping to typed exceptions
- Falling back to clipboard for large payloads

---

## Comparison with Browser Extension

| Aspect | Browser Extension | Mobile App (URL Scheme) |
|--------|-------------------|------------------------|
| Communication | postMessage + chrome.runtime | URL scheme redirect |
| Latency | <50ms (in-process) | 200-500ms (app switch) |
| Streaming | Yes (MessagePort) | No (request-response only) |
| UX for user | Seamless popup overlay | Brief app switch, then return |
| Caller identity | `window.location.origin` | Bundle ID / package name |
| Key storage | chrome.storage.local (encrypted) | Keychain / Keystore (encrypted) |
| Biometrics | N/A | Face ID / Touch ID / Fingerprint |
| Install detection | `window.injinaryWallet` exists | `canOpenURL` / `resolveActivity` |
| Auto-approve UX | No visible UI | Brief app flash, then return |
| Payload size | Unlimited (structured clone) | ~2KB URL limit (mitigations above) |
