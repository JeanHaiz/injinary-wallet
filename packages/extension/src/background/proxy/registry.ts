// ─── Provider Registry ───────────────────────────────────────────────────────
// Central registry of all supported AI providers.

import type { ProviderId } from "@injinary-wallet/shared";
import { AnthropicProxy } from "./anthropic.js";
import type { ProviderProxy } from "./base.js";
import { CustomProxy } from "./custom.js";
import { GoogleProxy } from "./google.js";
import { MistralProxy } from "./mistral.js";
import { OpenAIProxy } from "./openai.js";

const providers = new Map<ProviderId, ProviderProxy>();

// Register built-in providers
providers.set("openai", new OpenAIProxy());
providers.set("anthropic", new AnthropicProxy());
providers.set("google", new GoogleProxy());
providers.set("mistral", new MistralProxy());
providers.set("custom", new CustomProxy());

/** Get a provider proxy by ID */
export function getProvider(id: ProviderId): ProviderProxy | undefined {
	return providers.get(id);
}

/** Get all registered providers */
export function getAllProviders(): ProviderProxy[] {
	return [...providers.values()];
}

/** Get provider IDs */
export function getProviderIds(): ProviderId[] {
	return [...providers.keys()];
}
