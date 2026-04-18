# Building an AI Wallet Compatible App

This guide shows how to build a web app that uses AI Wallet for AI capabilities. Your app never touches API keys — the user's browser extension handles authentication, billing, and provider routing.

## How It Works

```
Your App (static site)          AI Wallet (browser extension)
     |                                    |
     |  1. detect wallet                  |
     |  --------------------------------> |
     |  <-- version, capabilities         |
     |                                    |
     |  2. request access                 |
     |  --------------------------------> |
     |         [user approves in popup]   |
     |  <-- permissions granted           |
     |                                    |
     |  3. send AI request                |
     |  --------------------------------> |
     |         [extension calls API]      |
     |  <-- normalized response           |
```

Your app talks to `window.aiWallet`, which the extension injects into every page. You never see the user's API key.

---

## Quick Start (5 minutes)

### Option A: Script Tag (no build step)

```html
<script type="module">
  // The extension injects window.aiWallet automatically.
  // No SDK import needed for basic usage.

  const wallet = window.aiWallet;

  if (!wallet) {
    document.body.textContent = "Please install AI Wallet";
    // Link to: https://github.com/anthropics/ai-wallet (TODO: real URL)
    throw new Error("AI Wallet not detected");
  }

  // 1. Check the wallet is responding
  const info = await wallet.detect();
  console.log(`AI Wallet v${info.version}`, info.capabilities);

  // 2. Request access (opens approval popup for the user)
  const permissions = await wallet.connect({
    appName: "My App",
    requestedProviders: ["openai", "anthropic"],
    requestedBudget: { amount: 500, period: "monthly" }, // 500 cents = $5/month
  });

  console.log("Connected!", permissions);
  // permissions = {
  //   origin: "https://my-app.com",
  //   allowedProviders: ["openai", "anthropic"],
  //   allowedModels: ["*"],
  //   budgetRemaining: 500,
  //   budgetLimit: 500,
  //   budgetPeriod: "monthly",
  //   autoApprove: true,
  // }
</script>
```

After connecting, use the SDK for AI calls (see Option B).

### Option B: SDK (recommended for real apps)

```bash
npm install @ai-wallet/sdk
```

```typescript
import { createAIWallet } from "@ai-wallet/sdk";

const wallet = createAIWallet();

// Check if extension is installed
if (!(await wallet.isAvailable())) {
  showInstallPrompt();
  return;
}

// Connect (triggers user approval on first visit)
const conn = await wallet.connect({
  appName: "My AI App",
  requestedProviders: ["anthropic"],
  requestedBudget: { amount: 1000, period: "monthly" }, // $10/month
});

// Make an AI call — the wallet handles the API key and billing
const response = await conn.complete({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is the capital of France?" },
  ],
});

console.log(response.content); // "The capital of France is Paris."
console.log(response.usage);   // { promptTokens: 25, completionTokens: 12, estimatedCostCents: 1 }
```

---

## SDK Reference

### Detection

```typescript
import { createAIWallet, isAvailable, detect } from "@ai-wallet/sdk";

// Quick boolean check
const installed = await isAvailable();

// Detailed info
const info = await detect();
// { version: "0.1.0", capabilities: ["chat", "embed", "stream", "budget"] }
```

### Connecting

```typescript
const wallet = createAIWallet();

const conn = await wallet.connect({
  appName: "My App",             // Shown to user in approval dialog
  appIcon: "/icon.png",          // Optional, shown in approval dialog
  requestedProviders: ["openai", "anthropic"], // Which providers you want
  requestedBudget: {             // Suggested budget (user can adjust)
    amount: 500,                 // In cents ($5.00)
    period: "monthly",           // "daily" | "weekly" | "monthly" | "total"
  },
});
```

The first call to `connect()` opens the wallet's approval popup. The user can:
- Choose which providers to allow
- Set a budget limit
- Enable/disable auto-approve

Subsequent calls from the same origin return instantly if already approved.

### Chat Completion

```typescript
const response = await conn.complete({
  messages: [
    { role: "system", content: "You are a pirate." },
    { role: "user", content: "Hello!" },
  ],
  provider: "anthropic",           // Optional — wallet picks default if omitted
  model: "claude-sonnet-4-20250514", // Optional — wallet picks default if omitted
  temperature: 0.7,                // Optional
  maxTokens: 1024,                 // Optional
});

// response = {
//   id: "msg_abc123",
//   provider: "anthropic",
//   model: "claude-sonnet-4-20250514",
//   content: "Ahoy there, matey!",
//   usage: {
//     promptTokens: 18,
//     completionTokens: 8,
//     totalTokens: 26,
//     estimatedCostCents: 1,
//   },
//   finishReason: "stop",
// }
```

**Provider-agnostic**: the response format is the same whether the request goes to OpenAI, Anthropic, or Google. Your app doesn't need provider-specific code.

### Streaming

```typescript
for await (const chunk of conn.completeStream({
  messages: [{ role: "user", content: "Write a poem about code" }],
})) {
  process.stdout.write(chunk.content);

  if (chunk.done && chunk.usage) {
    console.log("\nTokens used:", chunk.usage.totalTokens);
  }
}
```

### Embeddings

```typescript
const result = await conn.embed({
  input: ["Hello world", "Goodbye world"],
  provider: "openai",
  model: "text-embedding-3-small",
});

// result.embeddings = [[0.012, -0.034, ...], [0.056, 0.023, ...]]
```

### Budget Awareness

```typescript
const budget = await conn.getBudget();
// {
//   limit: 500,        // cents
//   spent: 123,        // cents used this period
//   remaining: 377,    // cents left
//   period: "monthly",
//   periodStart: 1713398400000,
//   periodEnd: 1716076800000,
// }

if (budget.remaining < 10) {
  showWarning("Low AI budget — some features may be limited");
}
```

### Available Models

```typescript
const models = await conn.listModels();
// [
//   { id: "gpt-4o", provider: "openai", name: "GPT-4o", capabilities: ["chat"] },
//   { id: "claude-sonnet-4-20250514", provider: "anthropic", name: "Claude Sonnet 4", capabilities: ["chat"] },
//   ...
// ]
```

### Events

```typescript
conn.on("budgetWarning", ({ remaining }) => {
  console.log(`Only ${remaining} cents remaining`);
});

conn.on("disconnected", () => {
  console.log("User revoked access");
});
```

### Cleanup

```typescript
conn.disconnect();
```

---

## Handling the "No Wallet" Case

Not every user will have AI Wallet installed. Handle this gracefully:

```typescript
import { isAvailable } from "@ai-wallet/sdk";

if (await isAvailable()) {
  // Full AI experience
  initAIFeatures();
} else {
  // Degrade gracefully — options:
  // 1. Show a link to install the extension
  // 2. Fall back to asking the user to paste an API key
  // 3. Disable AI features with an explanation
  showBanner(
    "Install AI Wallet to use AI features",
    "https://github.com/anthropics/ai-wallet"
  );
}
```

---

## Error Handling

The SDK throws `AIWalletError` with a `code` property:

```typescript
import { AIWalletError } from "@ai-wallet/sdk";

try {
  const response = await conn.complete({ messages });
} catch (err) {
  if (err instanceof AIWalletError) {
    switch (err.code) {
      case 4001: // WalletLocked
        showMessage("Please unlock your AI Wallet");
        break;
      case 4002: // PermissionDenied
        showMessage("This model is not allowed by your wallet settings");
        break;
      case 4003: // BudgetExceeded
        showMessage("AI budget exceeded — adjust in wallet settings");
        break;
      case 4004: // RateLimited
        showMessage("Too many requests — try again in a moment");
        break;
      case 4005: // ProviderError
        showMessage("AI provider returned an error: " + err.message);
        break;
      case 4100: // UserRejected
        showMessage("Connection request denied by user");
        break;
      case 4200: // NotConnected
        showMessage("Not connected — call connect() first");
        break;
    }
  }
}
```

---

## Complete Example: AI Chat App

A minimal but complete chat app — just HTML, no build step, no server:

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI Chat</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }
    #messages { border: 1px solid #ddd; padding: 16px; min-height: 300px; margin-bottom: 12px; }
    .msg { margin-bottom: 8px; }
    .user { color: #2563eb; }
    .ai { color: #16a34a; }
    input { width: calc(100% - 80px); padding: 8px; }
    button { padding: 8px 16px; }
    #status { color: #888; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>AI Chat</h1>
  <div id="status">Connecting to AI Wallet...</div>
  <div id="messages"></div>
  <div>
    <input id="input" placeholder="Type a message..." disabled />
    <button id="send" disabled>Send</button>
  </div>

  <script type="module">
    const statusEl = document.getElementById("status");
    const messagesEl = document.getElementById("messages");
    const inputEl = document.getElementById("input");
    const sendBtn = document.getElementById("send");

    const messages = [];
    let conn = null;

    // ── Connect to wallet ──

    async function init() {
      if (!window.aiWallet) {
        statusEl.textContent = "AI Wallet not found. Please install the extension.";
        return;
      }

      try {
        const perms = await window.aiWallet.connect({
          appName: "AI Chat",
          requestedProviders: ["openai", "anthropic"],
          requestedBudget: { amount: 200, period: "daily" },
        });

        statusEl.textContent = `Connected — budget: ${perms.budgetRemaining}¢ remaining`;
        inputEl.disabled = false;
        sendBtn.disabled = false;

        // We store the permissions but use window.aiWallet for calls
        // In a real app you'd use the SDK's Connection object
        conn = perms;
      } catch (err) {
        statusEl.textContent = `Connection failed: ${err.message}`;
      }
    }

    // ── Send message ──

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;

      messages.push({ role: "user", content: text });
      addMessageToUI("user", text);
      inputEl.value = "";
      sendBtn.disabled = true;

      try {
        // Use postMessage protocol directly (or use the SDK for a cleaner API)
        const response = await rpc("ai_complete", {
          messages: messages,
        });

        messages.push({ role: "assistant", content: response.content });
        addMessageToUI("ai", response.content);
        statusEl.textContent = `Last request: ${response.usage.estimatedCostCents}¢ — ${response.usage.totalTokens} tokens`;
      } catch (err) {
        addMessageToUI("ai", `Error: ${err.message}`);
      }

      sendBtn.disabled = false;
      inputEl.focus();
    }

    // ── Minimal RPC helper (use the SDK instead in real apps) ──

    let rpcId = 0;
    function rpc(method, params) {
      return new Promise((resolve, reject) => {
        const id = `chat_${++rpcId}`;
        function handler(event) {
          if (event.data?.type !== "AI_WALLET_RPC_RESPONSE" || event.data.id !== id) return;
          window.removeEventListener("message", handler);
          if (event.data.error) reject(new Error(event.data.error.message));
          else resolve(event.data.result);
        }
        window.addEventListener("message", handler);
        window.postMessage({ type: "AI_WALLET_RPC", id, method, params }, "*");
      });
    }

    function addMessageToUI(role, text) {
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.textContent = `${role === "user" ? "You" : "AI"}: ${text}`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

    setTimeout(init, 200); // Wait for content script injection
  </script>
</body>
</html>
```

Save this as a single HTML file, serve it with any static server (`npx serve .`), and it works — no backend, no API keys in your code.

---

## Architecture Notes for App Developers

**Your app is a static site.** It can be hosted on GitHub Pages, Netlify, Vercel, or any CDN. No server-side code is needed for AI calls.

**The wallet is the trust boundary.** Your app sends plaintext messages to the wallet. The wallet encrypts them with the user's API key and sends them to the provider. Your app never sees the key.

**Budget is enforced by the wallet, not your app.** You can *read* the budget, but you can't *change* it. The user controls spending through the extension popup.

**Responses are normalized.** Whether the user has OpenAI, Anthropic, or Google keys configured, your app receives the same response shape. You can optionally request a specific provider/model, but it's not required.

**The user can revoke access at any time.** Handle the `disconnected` event and degrade gracefully.

---

## Provider Options Passthrough

For advanced use cases, you can pass provider-specific options that the wallet forwards as-is:

```typescript
const response = await conn.complete({
  messages: [{ role: "user", content: "Explain quantum computing" }],
  provider: "openai",
  model: "gpt-4o",
  providerOptions: {
    response_format: { type: "json_object" },
    seed: 42,
  },
});
```

The wallet does not validate `providerOptions` — they are passed directly to the provider API.

---

## Supported Providers

| Provider | Chat | Stream | Embed |
|---|---|---|---|
| OpenAI | Yes | Yes | Yes |
| Anthropic | Yes | Yes | No |
| Google | Planned | Planned | Planned |
| Mistral | Planned | Planned | Planned |
| Custom (OpenAI-compatible) | Yes | Yes | Yes |

Users configure which providers they have keys for in the wallet. Your app doesn't need to know — just send requests and the wallet routes them.
