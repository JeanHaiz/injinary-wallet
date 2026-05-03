import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnthropicProxy } from "./anthropic.js";

// ─── Mock fetch globally ────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
vi.stubGlobal("crypto", { randomUUID: () => "test-stream-id" });

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function textResponse(text: string, status: number): Response {
	return new Response(text, { status });
}

const proxy = new AnthropicProxy();

describe("AnthropicProxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("complete", () => {
		it("sends correct request format to Anthropic API", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "msg_123",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "Hello!" }],
					usage: { input_tokens: 10, output_tokens: 5 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("sk-ant-key", {
				messages: [
					{ role: "system", content: "You are helpful." },
					{ role: "user", content: "Hi" },
				],
				model: "claude-sonnet-4-20250514",
				temperature: 0.7,
				maxTokens: 200,
			});

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, options] = mockFetch.mock.calls[0]!;
			expect(url).toBe("https://api.anthropic.com/v1/messages");
			expect(options.method).toBe("POST");
			expect(options.headers["x-api-key"]).toBe("sk-ant-key");
			expect(options.headers["anthropic-version"]).toBe("2023-06-01");
			expect(options.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
			expect(options.headers["Content-Type"]).toBe("application/json");

			const body = JSON.parse(options.body);
			expect(body.model).toBe("claude-sonnet-4-20250514");
			expect(body.max_tokens).toBe(200);
			expect(body.temperature).toBe(0.7);
			// System message should be extracted into separate parameter
			expect(body.system).toBe("You are helpful.");
			// Messages should NOT contain the system message
			expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
		});

		it("extracts system message from messages array into separate parameter", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", {
				messages: [
					{ role: "system", content: "Be concise." },
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi" },
					{ role: "user", content: "How are you?" },
				],
			});

			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.system).toBe("Be concise.");
			expect(body.messages).toEqual([
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
				{ role: "user", content: "How are you?" },
			]);
		});

		it("omits system parameter when no system message provided", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", {
				messages: [{ role: "user", content: "Hi" }],
			});

			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.system).toBeUndefined();
		});

		it("maps response to normalized CompletionResponse", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "msg_abc",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "The answer is 42." }],
					usage: { input_tokens: 25, output_tokens: 10 },
					stop_reason: "end_turn",
				}),
			);

			const result = await proxy.complete("key", {
				messages: [{ role: "user", content: "What is the meaning of life?" }],
			});

			expect(result).toEqual({
				id: "msg_abc",
				provider: "anthropic",
				model: "claude-sonnet-4-20250514",
				content: "The answer is 42.",
				usage: {
					promptTokens: 25,
					completionTokens: 10,
					totalTokens: 35,
					estimatedCostCents: 0,
				},
				finishReason: "stop",
			});
		});

		it("maps max_tokens stop_reason to 'length' finish reason", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "truncated..." }],
					usage: { input_tokens: 10, output_tokens: 100 },
					stop_reason: "max_tokens",
				}),
			);

			const result = await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.finishReason).toBe("length");
		});

		it("maps non-max_tokens stop reasons to 'stop'", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			const result = await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.finishReason).toBe("stop");
		});

		it("defaults model to claude-sonnet-4-20250514 when not specified", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.model).toBe("claude-sonnet-4-20250514");
		});

		it("defaults max_tokens to 4096 when not specified", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.max_tokens).toBe(4096);
		});

		it("uses custom base URL when provided", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete(
				"key",
				{ messages: [{ role: "user", content: "Hi" }] },
				"https://proxy.example.com",
			);
			expect(mockFetch.mock.calls[0]![0]).toBe("https://proxy.example.com/v1/messages");
		});

		it("handles missing content blocks gracefully", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			const result = await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.content).toBe("");
		});

		it("handles missing usage gracefully", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "ok" }],
					stop_reason: "end_turn",
				}),
			);

			const result = await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.usage.promptTokens).toBe(0);
			expect(result.usage.completionTokens).toBe(0);
			expect(result.usage.totalTokens).toBe(0);
		});

		it("throws on API error with status and body", async () => {
			mockFetch.mockResolvedValue(textResponse('{"error": {"message": "invalid key"}}', 401));

			await expect(
				proxy.complete("bad-key", { messages: [{ role: "user", content: "Hi" }] }),
			).rejects.toThrow("Anthropic API error (401)");
		});

		it("passes providerOptions through to the request body", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", {
				messages: [{ role: "user", content: "Hi" }],
				providerOptions: { top_k: 10 },
			});

			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.top_k).toBe(10);
		});

		it("omits temperature when not provided", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "" }],
					usage: { input_tokens: 0, output_tokens: 0 },
					stop_reason: "end_turn",
				}),
			);

			await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.temperature).toBeUndefined();
		});

		it("calculates totalTokens as sum of input + output tokens", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "claude-sonnet-4-20250514",
					content: [{ type: "text", text: "ok" }],
					usage: { input_tokens: 100, output_tokens: 50 },
					stop_reason: "end_turn",
				}),
			);

			const result = await proxy.complete("key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.usage.totalTokens).toBe(150);
		});
	});

	describe("completeStream", () => {
		it("sends correct streaming request format", async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(
						encoder.encode('data: {"type":"content_block_delta","delta":{"text":"Hi"}}\n\n'),
					);
					controller.enqueue(
						encoder.encode('data: {"type":"message_delta","usage":{"output_tokens":1}}\n\n'),
					);
					controller.close();
				},
			});

			mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

			await proxy.completeStream("key", { messages: [{ role: "user", content: "Hi" }] }, () => {});

			const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
			expect(body.stream).toBe(true);
		});

		it("parses Anthropic SSE chunks into StreamChunk objects", async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(
						encoder.encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n'),
					);
					controller.enqueue(
						encoder.encode('data: {"type":"content_block_delta","delta":{"text":" world"}}\n\n'),
					);
					controller.enqueue(
						encoder.encode('data: {"type":"message_delta","usage":{"output_tokens":5}}\n\n'),
					);
					controller.close();
				},
			});

			mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

			const chunks: unknown[] = [];
			await proxy.completeStream("key", { messages: [{ role: "user", content: "Hi" }] }, (chunk) =>
				chunks.push(chunk),
			);

			expect(chunks).toEqual([
				{ id: "test-stream-id", content: "Hello", done: false },
				{ id: "test-stream-id", content: " world", done: false },
				{
					id: "test-stream-id",
					content: "",
					done: true,
					usage: { promptTokens: 0, completionTokens: 5, totalTokens: 5, estimatedCostCents: 0 },
				},
			]);
		});

		it("throws on streaming API error", async () => {
			mockFetch.mockResolvedValue(textResponse("overloaded", 529));

			await expect(
				proxy.completeStream("key", { messages: [{ role: "user", content: "Hi" }] }, () => {}),
			).rejects.toThrow("Anthropic API error (529): overloaded");
		});
	});

	describe("embed", () => {
		it("throws because Anthropic does not support embeddings", async () => {
			await expect(proxy.embed("key", { input: "hello" })).rejects.toThrow(
				"Anthropic does not currently offer an embeddings API",
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("listModels", () => {
		it("returns curated model list without API call", async () => {
			const models = await proxy.listModels("key");

			expect(models).toHaveLength(3);
			expect(models.map((m) => m.id)).toEqual([
				"claude-sonnet-4-20250514",
				"claude-haiku-4-5-20251001",
				"claude-opus-4-20250514",
			]);
			for (const model of models) {
				expect(model.provider).toBe("anthropic");
				expect(model.contextWindow).toBe(200_000);
				expect(model.capabilities).toContain("chat");
			}
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});
});
