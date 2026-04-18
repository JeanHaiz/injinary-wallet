# Injinary Wallet

A browser extension that manages AI API keys, budgets, and permissions so open-source web apps can use AI without ever touching your keys.

## How it works

Apps use the Injinary Wallet SDK to request AI completions. The extension holds your encrypted API keys, routes requests to the right provider, and enforces spending limits — all without exposing keys to the web page.

```
Web App (SDK) → Content Script → Service Worker → AI Provider
                                    ↓
                              Decrypt key from vault
                              Check budget & permissions
                              Proxy request to provider
                              Log usage & deduct cost
```

**Supported providers:** OpenAI, Anthropic (Google Gemini and Mistral coming soon)

## Features

- **Encrypted vault** — API keys stored with AES-256-GCM, derived via PBKDF2 (600k iterations)
- **Per-app budgets** — Daily, weekly, monthly, or lifetime spending limits per origin
- **Rate limiting** — Requests/minute and tokens/minute quotas per app
- **Permission grants** — Control which providers and models each app can access
- **Usage tracking** — Request history and daily aggregates for auditing
- **Zero-dependency SDK** — Lightweight client library with no runtime dependencies
- **Streaming support** — Stream completions via MessagePort

## Project structure

```
packages/
  extension/   Browser extension (WXT, Manifest V3)
  sdk/         npm package for web apps (@injinary-wallet/sdk)
  shared/      TypeScript types and RPC protocol definitions
  test-app/    Demo app for end-to-end testing
```

## Quick start

### Prerequisites

- Node.js >= 20
- pnpm

### Development

```bash
# Install dependencies
pnpm install

# Start all packages in dev mode
pnpm dev

# Build everything
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

### Load the extension

1. Run `pnpm -C packages/extension build`
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select `packages/extension/.output/chrome-mv3/`

## SDK usage

### Install

```bash
npm install @injinary-wallet/sdk
```

### Connect and complete

```typescript
import { createInjinaryWallet } from "@injinary-wallet/sdk";

const wallet = createInjinaryWallet();

if (await wallet.isAvailable()) {
  const connection = await wallet.connect({
    appName: "My App",
    requestedProviders: ["openai"],
    requestedBudget: { limit: 500, period: "monthly" }, // $5.00/month
  });

  const response = await connection.complete({
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  });

  console.log(response.content);
}
```

### Streaming

```typescript
const stream = await connection.completeStream({
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a poem" }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Other methods

```typescript
// List available models
const models = await connection.listModels();

// Check budget
const budget = await connection.getBudget();
console.log(`$${budget.remaining / 100} remaining`);

// Get usage history
const usage = await connection.getUsage();

// Listen for events
connection.on("budgetWarning", (info) => { /* ... */ });

// Disconnect
connection.disconnect();
```

## Error handling

The SDK throws `InjinaryWalletError` with typed error codes:

| Code | Name | Meaning |
|------|------|---------|
| 4001 | WalletLocked | User hasn't unlocked the vault |
| 4002 | PermissionDenied | App not authorized for this action |
| 4003 | BudgetExceeded | Spending limit reached |
| 4004 | RateLimited | Too many requests or tokens |
| 4005 | ProviderError | Upstream API error |
| 4100 | UserRejected | User denied the permission request |
| 4200 | NotConnected | No active connection |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.7 (strict) |
| Extension | WXT 0.19 (Manifest V3) |
| SDK bundler | tsup 8.3 |
| Linter | Biome 1.9 |
| Testing | Vitest 2.1 |
| Package manager | pnpm |

## Security model

- API keys are encrypted at rest and never leave the service worker
- Content scripts run in an isolated world — pages cannot intercept messages
- `window.injinaryWallet` is frozen and non-configurable to prevent tampering
- Budget enforcement happens server-side (in the extension); apps cannot bypass it
- Master key is held in memory only and expires after a configurable timeout (default: 15 min)

## License

[GPL-3.0](LICENSE)
