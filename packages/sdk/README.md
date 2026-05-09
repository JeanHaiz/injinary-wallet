# @injinary-wallet/sdk

Client SDK for [Injinary Wallet](https://chromewebstore.google.com/detail/injinary-wallet/emnpfdhpjmgbdgmbpcbloncillceljgp) — a browser extension that holds AI provider API keys (OpenAI, Anthropic, …) so web apps can run completions, embeddings, and streams **without ever seeing the user's keys**.

The user installs the extension, you install this SDK. Your app asks for permission, the user approves, and you get a `Connection` object that proxies AI calls through the extension's service worker. Keys stay encrypted in the wallet, budgets and rate limits are enforced extension-side, and your app never touches secret material.

## Install

```bash
npm install @injinary-wallet/sdk
# or
pnpm add @injinary-wallet/sdk
# or
yarn add @injinary-wallet/sdk
```

Zero runtime dependencies. Ships ESM + CJS + TypeScript types.

## Quick start

```ts
import { createInjinaryWallet, promptInstallIfMissing } from "@injinary-wallet/sdk";

const wallet = createInjinaryWallet();

// One-liner: shows a floating install banner if the extension is missing.
if (await promptInstallIfMissing({ appName: "My App" })) return;

const connection = await wallet.connect({
  appName: "My App",
  requestedProviders: ["openai"],
  requestedBudget: { limit: 500, period: "monthly" }, // $5.00/month, in cents
});

const response = await connection.complete({
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.content);
```

## Streaming

```ts
const stream = await connection.completeStream({
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a haiku about TypeScript" }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## API

### `createInjinaryWallet(): InjinaryWallet`

Returns the top-level wallet handle.

```ts
interface InjinaryWallet {
  detect(): Promise<WalletInfo | null>;       // version, supported providers
  isAvailable(): Promise<boolean>;             // is the extension installed?
  connect(params: ConnectParams): Promise<Connection>;
}
```

### `Connection`

Returned from `wallet.connect(...)` after the user approves access.

| Method | Returns | Notes |
| --- | --- | --- |
| `complete(request)` | `Promise<CompletionResponse>` | One-shot completion |
| `completeStream(request)` | `AsyncIterable<StreamChunk>` | Streamed completion |
| `embed(request)` | `Promise<EmbedResponse>` | Embeddings |
| `listModels()` | `Promise<ModelInfo[]>` | Models the user has authorised for this app |
| `getPermissions()` | `Promise<PermissionSummary>` | Current grants |
| `getBudget()` | `Promise<BudgetStatus>` | Remaining spend, period, limit |
| `getUsage({ limit?, since? })` | `Promise<UsageEntry[]>` | Audit log entries |
| `on(event, handler)` | `() => void` | Subscribe; returns an unsubscribe function |
| `disconnect()` | `void` | Tear down listeners |

Events: `budgetWarning`, `disconnected`, `permissionsChanged`.

### Install prompt

Helpers for pointing users to the Chrome Web Store when the extension isn't installed:

```ts
import {
  INJINARY_WALLET_INSTALL_URL,
  openInstallPage,
  promptInstallIfMissing,
  showInstallPrompt,
} from "@injinary-wallet/sdk";

// Auto-detect, then render a floating banner if the wallet is missing.
await promptInstallIfMissing({ appName: "My App", position: "bottom-right" });

// Or render the banner unconditionally and control it yourself.
const prompt = showInstallPrompt({ appName: "My App", dismissible: true });
prompt.hide();
prompt.destroy();

// Or just open the store page in a new tab.
openInstallPage(); // defaults to INJINARY_WALLET_INSTALL_URL
```

`InstallPromptOptions`: `appName`, `position` (`top` / `bottom` / `top-left` / `top-right` / `bottom-left` / `bottom-right`), `installUrl`, `message`, `ctaLabel`, `dismissible`, `zIndex`, `onInstall`, `onDismiss`.

### Errors

All RPC failures throw `InjinaryWalletError` with a typed `code`:

| Code | Meaning |
| --- | --- |
| 4001 | Wallet locked — user hasn't unlocked the vault |
| 4002 | Permission denied — app not authorised for this action |
| 4003 | Budget exceeded |
| 4004 | Rate limited (requests/min or tokens/min) |
| 4005 | Provider error (upstream API) |
| 4100 | User rejected the permission request |
| 4200 | Not connected |

```ts
import { InjinaryWalletError } from "@injinary-wallet/sdk";

try {
  await connection.complete(request);
} catch (err) {
  if (err instanceof InjinaryWalletError && err.code === 4003) {
    showBudgetExhaustedUI();
  } else {
    throw err;
  }
}
```

## How it works

```
Web App (this SDK) → Content Script → Service Worker → AI Provider
                                          ↓
                                    Decrypt key from vault
                                    Check budget & permissions
                                    Proxy request to provider
                                    Log usage & deduct cost
```

The SDK communicates with the extension via `window.postMessage`, so it works in any browser context where the extension is installed (Chrome MV3 today; Firefox/Edge planned).

## License

MIT — see [LICENSE](./LICENSE). The Injinary Wallet extension itself is GPL-3.0; the SDK is intentionally permissive so you can integrate without copyleft obligations.

## Links

- Extension on the Chrome Web Store: <https://chromewebstore.google.com/detail/injinary-wallet/emnpfdhpjmgbdgmbpcbloncillceljgp>
- Repository: <https://github.com/JeanHaiz/injinary-wallet>
- Issues: <https://github.com/JeanHaiz/injinary-wallet/issues>
- Privacy policy: <https://jeanhaiz.github.io/injinary-wallet/privacy.html>
