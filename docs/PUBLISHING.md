# Publishing Injinary Wallet

How to ship the extension to the Chrome Web Store (and, optionally, Firefox / Edge).

---

## One-time setup

### 1. Build the extension

```bash
pnpm -C packages/extension build           # → packages/extension/.output/chrome-mv3/
pnpm -C packages/extension exec wxt zip    # → packages/extension/.output/<name>-<version>-chrome.zip
```

### 2. Manual first upload to Chrome Web Store

The Chrome Web Store API can only **update** an existing listing — it cannot create one. So your first publish has to go through the dashboard:

1. Go to <https://chrome.google.com/webstore/devconsole> and pay the one-time $5 developer fee if you have not already.
2. Click **New item**, upload the zip from step 1.
3. Fill in the required listing fields:
   - **Description** (short + detailed)
   - **Category**: "Productivity" is the standard fit
   - **Privacy practices**: declare what data the extension handles
   - **Privacy policy URL**: <https://jeanhaiz.github.io/injinary-wallet/privacy.html> (set up below)
   - **Single purpose justification**: "Stores AI provider API keys locally and proxies authorised requests so web apps never see the keys."
   - **Permission justifications**: use the paragraphs below for `storage`, `activeTab`, and `unlimitedStorage` (see [Permission justifications](#permission-justifications))
   - **Screenshots**: 1280×800 or 640×400, at least one
   - **Promotional tile**: 440×280
4. Submit for review. First review typically takes a few business days.

Once published (or even just submitted), copy the **Item ID** — that's your `CHROME_EXTENSION_ID`.

### 3. Set up GitHub Pages for the privacy policy

The Chrome Web Store requires a public privacy-policy URL. This repo ships one in `docs/`.

1. Push the repo to GitHub.
2. In the repo, go to **Settings → Pages**.
3. **Source**: Deploy from a branch.
4. **Branch**: `main` / folder: `/docs`.
5. Save. After ~1 minute, the site is live at <https://jeanhaiz.github.io/injinary-wallet/>.
6. The privacy policy lives at <https://jeanhaiz.github.io/injinary-wallet/privacy.html> — paste this into the store listing.

### 4. Get Chrome Web Store API credentials

The API uses Google OAuth 2.0 for authentication.

1. Open <https://console.cloud.google.com> and create a new project (or reuse one).
2. Enable the **Chrome Web Store API** in the API Library.
3. Configure the OAuth consent screen (External, `injinary@gmail.com` as the contact — not your personal address; this email is publicly visible).
4. Create OAuth credentials of type **Desktop app**. Note down the `client_id` and `client_secret`.
5. Generate a refresh token (one-time):

   Open this URL in your browser, replacing `<CLIENT_ID>`:

   ```
   https://accounts.google.com/o/oauth2/auth?response_type=code&access_type=offline&scope=https://www.googleapis.com/auth/chromewebstore&client_id=<CLIENT_ID>&redirect_uri=urn:ietf:wg:oauth:2.0:oob
   ```

   Authorise the app, copy the code Google shows you, then exchange it for a refresh token:

   ```bash
   curl "https://oauth2.googleapis.com/token" \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>" \
     -d "code=<CODE_FROM_BROWSER>" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
   ```

   The JSON response contains `refresh_token`. Save it — Google only shows it once.

6. Copy `.env.example` to `.env` at the repo root and fill in:

   ```
   CHROME_EXTENSION_ID=<from step 2>
   CHROME_CLIENT_ID=<from step 4>
   CHROME_CLIENT_SECRET=<from step 4>
   CHROME_REFRESH_TOKEN=<from step 5>
   ```

`.env` is already in `.gitignore` — keep it out of git.

---

## Routine publishing

After the one-time setup, every release is two commands:

```bash
# 1. Bump the version in packages/extension/package.json (semver)
# 2. Build, zip, and upload as a draft
pnpm -C packages/extension exec wxt submit \
  --chrome-zip .output/<name>-<version>-chrome.zip
```

Or, more verbosely:

```bash
# Build + zip
pnpm -C packages/extension exec wxt zip

# Find the zip filename
ls packages/extension/.output/*.zip

# Upload (auto-loads .env)
pnpm -C packages/extension exec wxt submit \
  --chrome-zip packages/extension/.output/<filename>.zip
```

`wxt submit` uploads the zip and submits it for review. The submitted version stays as a draft until Google's automated checks pass; then it goes live (or you have to address reviewer feedback).

---

## Multi-browser

```bash
# Build for each target
pnpm -C packages/extension build -b chrome
pnpm -C packages/extension build -b firefox
pnpm -C packages/extension build -b edge

# Zip for each target (Firefox also produces a sources zip — Mozilla requires it)
pnpm -C packages/extension exec wxt zip -b firefox
pnpm -C packages/extension exec wxt zip -b edge

# Submit to each (uses the matching env vars from .env)
pnpm -C packages/extension exec wxt submit \
  --firefox-zip .output/<name>-<version>-firefox.zip \
  --firefox-sources-zip .output/<name>-<version>-sources.zip
```

---

## Pre-flight checklist

Before pushing a release:

- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass
- [ ] Version bumped in `packages/extension/package.json`
- [ ] Manifest icons render correctly at 16/32/48/128
- [ ] Popup loads with no console errors when installed from the built zip
- [ ] Google Fonts requests succeed in production (DevTools → Network) — currently loaded via `@import` in `popup/styles.ts`. If they ever fail under a tighter CSP, self-host the woff2 files in `src/public/fonts/`.
- [ ] Privacy policy URL still resolves: <https://jeanhaiz.github.io/injinary-wallet/privacy.html>
- [ ] `LICENSE` (GPL-3.0) and contact email are accurate

---

## Permission justifications

Paste these into the Chrome Web Store listing's permission-justification fields. They map one-to-one to the permissions declared in `wxt.config.ts`.

### `storage`

Injinary Wallet's core function is to hold AI provider API keys (OpenAI, Anthropic, etc.) on the user's behalf so that web apps can request AI completions without ever seeing the raw key. Those keys, along with per-provider budgets, per-origin permissions, and the user's encryption settings, must persist across browser sessions and survive popup close — the only way to do that in an MV3 extension is `chrome.storage`. Without this permission the extension cannot remember a single key and has no reason to exist.

### `activeTab`

When a web app calls the extension to proxy an AI request, the extension needs to know _which origin_ is asking before it decides whether to honour the call and which budget to charge. `activeTab` gives Injinary Wallet a temporary, user-gesture-scoped read of the active tab's URL so it can resolve the requesting origin and match it against the user's allow-list of permitted apps. The permission is intentionally narrower than `tabs` or `<all_urls>`: it only activates when the user explicitly invokes the extension, and grants no background access to browsing history or tab contents.

### `unlimitedStorage`

Injinary Wallet keeps a local usage history (timestamps, providers, models, token counts, costs) so users can audit which app spent which budget. For heavy users — or anyone running long-lived agents through the wallet — this log can grow past Chrome's default 5 MB `chrome.storage.local` quota within weeks. `unlimitedStorage` lifts that cap so the audit log stays complete instead of silently truncating. It is declared as an **optional** permission: users who do not want a long retention window can decline it and the extension falls back to ring-buffering the most recent entries.

---

## If something goes wrong

| Symptom                                        | Fix                                                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `wxt submit` says `invalid_grant`              | Refresh token expired. Regenerate via step 5 above.                                                                         |
| Reviewer rejects with "single purpose unclear" | Tighten the listing description; the extension _only_ manages keys + proxies AI calls.                                      |
| Reviewer rejects on permissions                | Justify `storage` (encrypted vault), `activeTab` (read origin of requesting app), `unlimitedStorage` (large usage history). |
| Fonts fail to load                             | Either widen CSP (`style-src https://fonts.googleapis.com; font-src https://fonts.gstatic.com;`) or self-host.              |

---

# Publishing the SDK to npm

The `@injinary-wallet/sdk` package is what web apps `npm install` to talk to the extension. It is licensed **MIT** (separately from the GPL-3.0 extension) so consuming apps don't inherit copyleft obligations. The two artifacts communicate over `window.postMessage` → content script → service worker, which is treated as an arm's-length IPC boundary, so the licenses are independent.

## One-time setup

1. Create an npm account at <https://www.npmjs.com/signup> if you don't have one — use `injinary@gmail.com` for the public-facing fields.
2. Authenticate locally:

   ```bash
   npm login
   npm whoami   # confirm
   ```

3. Confirm the `@injinary-wallet` scope is available / owned by your account. The first publish below claims it; subsequent publishes just use it.

## Routine publishing

Every release is the same flow:

```bash
# 1. Pre-flight — everything must pass
pnpm install
pnpm -C packages/sdk typecheck
pnpm -C packages/sdk test
pnpm -C packages/sdk build         # cleans dist/, emits ESM + CJS + .d.ts

# 2. Bump the version in packages/sdk/package.json (semver)

# 3. Inspect what will ship — should be only dist/, package.json, LICENSE, (README.md if present)
#    pnpm's `pack` has no --dry-run, so use npm pack here even if pnpm is your daily driver.
(cd packages/sdk && npm pack --dry-run)

# 4. Publish (use npm here — pnpm's `publish` wrapper has had argument-forwarding bugs
#    that surface as `npm error EUSAGE`. npm publish from inside the package is reliable.)
#
#    npm requires 2FA on most accounts. Pick the flow that matches how you set up 2FA:
#      - Security key / passkey (WebAuthn): just run the command below. npm 9+ will
#        print a confirmation URL — open it, tap your key, and the CLI continues.
#      - Authenticator app (TOTP): add `--otp=<6-digit-code>` from the app.
#      - Granular access token with bypass-2FA: configure once via
#        `npm config set //registry.npmjs.org/:_authToken=<token>`, then no prompt.
(cd packages/sdk && npm publish --access public)
```

`publishConfig.access: "public"` is already set in `packages/sdk/package.json`, but passing `--access public` on the CLI is a belt-and-braces guard against npm defaulting scoped packages to `restricted` (which fails on free accounts).

## Post-publish

```bash
# Tag the release in git
git tag sdk-v<version> && git push --tags
```

- Verify the listing at <https://www.npmjs.com/package/@injinary-wallet/sdk>.
- Smoke test from a clean directory:

  ```bash
  cd /tmp && mkdir sdk-smoke && cd sdk-smoke
  npm init -y && npm i @injinary-wallet/sdk
  node --input-type=module -e "import('@injinary-wallet/sdk').then(m => console.log(Object.keys(m)))"
  ```

## Pre-flight checklist (SDK)

Before each SDK release:

- [ ] `pnpm -C packages/sdk typecheck && pnpm -C packages/sdk test` pass
- [ ] `pnpm -C packages/sdk build` produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`
- [ ] Version bumped in `packages/sdk/package.json`
- [ ] `(cd packages/sdk && npm pack --dry-run)` lists only `dist/**`, `package.json`, `LICENSE` (and `README.md` if it exists) — no source, no `tsup.config.ts`, no `node_modules` (pnpm's `pack` has no `--dry-run` flag, so use npm here)
- [ ] `dist/index.js` has `@injinary-wallet/shared` symbols inlined (the bundle should not contain `import … from "@injinary-wallet/shared"`)
- [ ] Root README install instructions still match the published name

## If something goes wrong (SDK)

| Symptom                              | Fix                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `403 Forbidden — 2FA required`       | Depends on your 2FA method. **WebAuthn (security key/passkey):** rerun without `--otp`; npm 9+ prints a URL — open it and tap your key. **TOTP (authenticator app):** add `--otp=<6-digit-code>`. **Granular access token with bypass-2FA:** set `npm config set //registry.npmjs.org/:_authToken=<token>` once. |
| `403 Forbidden` on first publish     | Pass `--access public`. Free npm accounts cannot publish private scoped packages.                                                |
| `E402 Payment Required`              | Same — npm thinks you're trying to publish a private package. Add `--access public`.                                             |
| `EPUBLISHCONFLICT` / `version exists`| npm versions are immutable. Bump the version in `packages/sdk/package.json` and republish.                                       |
| `ENEEDAUTH`                          | `npm login` again; the auth token expired.                                                                                       |
| Tarball includes source files        | Check `files` in `packages/sdk/package.json` — should be `["dist"]`. Re-run `pack --dry-run` until clean.                        |

## Rollback

npm versions cannot be overwritten, but they can be deprecated within 72 hours:

```bash
npm deprecate @injinary-wallet/sdk@<version> "Deprecated — use <newer version>"
```

Or unpublish if caught fast (only works within 72 hours, only if no public packages depend on it):

```bash
npm unpublish @injinary-wallet/sdk@<version>
```
