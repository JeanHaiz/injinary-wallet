import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIProxy } from "./openai.js";

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

const proxy = new OpenAIProxy();

describe("OpenAIProxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("complete", () => {
		it("sends correct request format to OpenAI API", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "chatcmpl-123",
					model: "gpt-4o",
					choices: [{ message: { content: "Hello!" }, finish_reason: "stop" }],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				}),
			);

			await proxy.complete("sk-test-key", {
				messages: [
					{ role: "system", content: "You are helpful." },
					{ role: "user", content: "Hi" },
				],
				model: "gpt-4o",
				temperature: 0.7,
				maxTokens: 100,
			});

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe("https://api.openai.com/v1/chat/completions");
			expect(options.method).toBe("POST");
			expect(options.headers.Authorization).toBe("Bearer sk-test-key");
			expect(options.headers["Content-Type"]).toBe("application/json");

			const body = JSON.parse(options.body);
			expect(body.model).toBe("gpt-4o");
			expect(body.messages).toEqual([
				{ role: "system", content: "You are helpful." },
				{ role: "user", content: "Hi" },
			]);
			expect(body.temperature).toBe(0.7);
			expect(body.max_tokens).toBe(100);
		});

		it("maps response to normalized CompletionResponse", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "chatcmpl-abc",
					model: "gpt-4o-2024-08-06",
					choices: [{ message: { content: "The answer is 42." }, finish_reason: "stop" }],
					usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 },
				}),
			);

			const result = await proxy.complete("sk-key", {
				messages: [{ role: "user", content: "What is the meaning of life?" }],
			});

			expect(result).toEqual({
				id: "chatcmpl-abc",
				provider: "openai",
				model: "gpt-4o-2024-08-06",
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

		it("defaults model to gpt-4o when not specified", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "" }, finish_reason: "stop" }],
					usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
				}),
			);

			await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.model).toBe("gpt-4o");
		});

		it("uses custom base URL when provided", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "" }, finish_reason: "stop" }],
					usage: {},
				}),
			);

			await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] }, "https://custom.api.com/v1");
			expect(mockFetch.mock.calls[0][0]).toBe("https://custom.api.com/v1/chat/completions");
		});

		it("normalizes finish_reason 'length' correctly", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "truncated..." }, finish_reason: "length" }],
					usage: { prompt_tokens: 10, completion_tokens: 100, total_tokens: 110 },
				}),
			);

			const result = await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.finishReason).toBe("length");
		});

		it("normalizes finish_reason 'content_filter' correctly", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "" }, finish_reason: "content_filter" }],
					usage: {},
				}),
			);

			const result = await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.finishReason).toBe("content_filter");
		});

		it("defaults unknown finish_reason to 'stop'", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "" }, finish_reason: "function_call" }],
					usage: {},
				}),
			);

			const result = await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.finishReason).toBe("stop");
		});

		it("handles missing content gracefully", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: {}, finish_reason: "stop" }],
					usage: {},
				}),
			);

			const result = await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.content).toBe("");
		});

		it("handles missing usage gracefully", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
				}),
			);

			const result = await proxy.complete("sk-key", { messages: [{ role: "user", content: "Hi" }] });
			expect(result.usage.promptTokens).toBe(0);
			expect(result.usage.completionTokens).toBe(0);
			expect(result.usage.totalTokens).toBe(0);
		});

		it("throws on API error with status and body", async () => {
			mockFetch.mockResolvedValue(textResponse('{"error": "invalid key"}', 401));

			await expect(
				proxy.complete("bad-key", { messages: [{ role: "user", content: "Hi" }] }),
			).rejects.toThrow('OpenAI API error (401): {"error": "invalid key"}');
		});

		it("passes providerOptions through to the request body", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					id: "x",
					model: "gpt-4o",
					choices: [{ message: { content: "" }, finish_reason: "stop" }],
					usage: {},
				}),
			);

			await proxy.complete("sk-key", {
				messages: [{ role: "user", content: "Hi" }],
				providerOptions: { top_p: 0.9, frequency_penalty: 0.5 },
			});

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.top_p).toBe(0.9);
			expect(body.frequency_penalty).toBe(0.5);
		});
	});

	describe("completeStream", () => {
		it("sends correct streaming request format", async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
					controller.enqueue(encoder.encode("data: [DONE]\n\n"));
					controller.close();
				},
			});

			mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

			const chunks: unknown[] = [];
			await proxy.completeStream("sk-key", { messages: [{ role: "user", content: "Hi" }], model: "gpt-4o" }, (chunk) =>
				chunks.push(chunk),
			);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.stream).toBe(true);
			expect(body.stream_options).toEqual({ include_usage: true });
		});

		it("parses SSE chunks into StreamChunk objects", async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
					controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'));
					controller.enqueue(
						encoder.encode(
							'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
						),
					);
					controller.enqueue(encoder.encode("data: [DONE]\n\n"));
					controller.close();
				},
			});

			mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

			const chunks: unknown[] = [];
			await proxy.completeStream("sk-key", { messages: [{ role: "user", content: "Hi" }] }, (chunk) =>
				chunks.push(chunk),
			);

			expect(chunks).toEqual([
				{ id: "test-stream-id", content: "Hello", done: false },
				{ id: "test-stream-id", content: " world", done: false },
				{
					id: "test-stream-id",
					content: "",
					done: true,
					usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7, estimatedCostCents: 0 },
				},
				{ id: "test-stream-id", content: "", done: true },
			]);
		});

		it("throws on streaming API error", async () => {
			mockFetch.mockResolvedValue(textResponse("rate limited", 429));

			await expect(
				proxy.completeStream("sk-key", { messages: [{ role: "user", content: "Hi" }] }, () => {}),
			).rejects.toThrow("OpenAI API error (429): rate limited");
		});
	});

	describe("embed", () => {
		it("sends correct embedding request format", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					model: "text-embedding-3-small",
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { total_tokens: 5 },
				}),
			);

			await proxy.embed("sk-key", { input: "hello world" });

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe("https://api.openai.com/v1/embeddings");
			const body = JSON.parse(options.body);
			expect(body.model).toBe("text-embedding-3-small");
			expect(body.input).toBe("hello world");
		});

		it("maps embedding response to normalized EmbedResponse", async () => {
			mockFetch.mockResolvedValue(
				jsonResponse({
					model: "text-embedding-3-small",
					data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
					usage: { total_tokens: 12 },
				}),
			);

			const result = await proxy.embed("sk-key", { input: ["hello", "world"] });

			expect(result).toEqual({
				provider: "openai",
				model: "text-embedding-3-small",
				embeddings: [
					[0.1, 0.2],
					[0.3, 0.4],
				],
				usage: { totalTokens: 12, estimatedCostCents: 0 },
			});
		});

		it("throws on embedding API error", async () => {
			mockFetch.mockResolvedValue(textResponse("bad request", 400));

			await expect(proxy.embed("bad-key", { input: "hi" })).rejects.toThrow("OpenAI API error (400)");
		});
	});

	describe("listModels", () => {
		it("returns curated model list without API call", async () => {
			const models = await proxy.listModels("sk-key");

			expect(models).toHaveLength(4);
			expect(models.map((m) => m.id)).toEqual([
				"gpt-4o",
				"gpt-4o-mini",
				"text-embedding-3-small",
				"text-embedding-3-large",
			]);
			for (const model of models) {
				expect(model.provider).toBe("openai");
			}
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});
});
