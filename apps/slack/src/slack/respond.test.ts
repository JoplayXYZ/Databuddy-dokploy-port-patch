import { describe, expect, it } from "bun:test";
import type { DatabuddyAgentClient } from "../agent/agent-client";
import { SLACK_COPY } from "./messages";
import { streamAgentToSlack } from "./respond";

describe("Databuddy Slack response streaming", () => {
	it("starts streams with answer text, not a loading placeholder", async () => {
		const originalDateNow = Date.now;
		let now = 0;
		const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
		const client = {
			apiCall: async (method: string, options?: Record<string, unknown>) => {
				calls.push({ method, options: options ?? {} });
				if (method === "chat.startStream") {
					return { ok: true, ts: "stream_ts" };
				}
				return { ok: true };
			},
		};
		const agent: Pick<DatabuddyAgentClient, "stream"> = {
			async *stream() {
				now = 1000;
				yield "Traffic is up 12%.";
			},
		};

		Date.now = () => now;
		let result: Awaited<ReturnType<typeof streamAgentToSlack>> | undefined;
		try {
			result = await streamAgentToSlack({
				agent,
				client,
				logger: {
					error: () => {},
					warn: () => {},
				},
				run: {
					channelId: "C123",
					messageTs: "171234.567",
					teamId: "T123",
					text: "What changed?",
					threadTs: "171234.567",
					trigger: "app_mention",
					userId: "U123",
				},
				say: async () => {},
			});
		} finally {
			Date.now = originalDateNow;
		}

		expect(result).toMatchObject({
			ok: true,
			responseTs: "stream_ts",
			streamed: true,
		});
		expect(calls[0]).toEqual({
			method: "chat.startStream",
			options: expect.objectContaining({
				markdown_text: "Traffic is up 12%.",
			}),
		});
		expect(calls[0]?.options.markdown_text).not.toBe(SLACK_COPY.streamOpening);
		expect(calls.map((call) => call.method)).toEqual([
			"chat.startStream",
			"chat.stopStream",
		]);
	});

	it("does not append a failure message after a partial answer streamed", async () => {
		const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
		const client = {
			apiCall: async (method: string, options?: Record<string, unknown>) => {
				calls.push({ method, options: options ?? {} });
				if (method === "chat.startStream") {
					return { ok: true, ts: "stream_ts" };
				}
				return { ok: true };
			},
		};
		const agent: Pick<DatabuddyAgentClient, "stream"> = {
			async *stream() {
				yield "Qais has great taste in analytics tools.";
				throw new Error("late stream failure");
			},
		};

		const result = await streamAgentToSlack({
			agent,
			client,
			logger: {
				error: () => {},
				warn: () => {},
			},
			run: {
				channelId: "C123",
				messageTs: "171234.567",
				teamId: "T123",
				text: "say something nice",
				threadTs: "171234.567",
				trigger: "app_mention",
				userId: "U123",
			},
			say: async () => {},
		});

		expect(result).toMatchObject({ ok: false, streamed: true });
		expect(calls.map((call) => call.method)).toEqual([
			"chat.startStream",
			"chat.stopStream",
		]);
		expect(calls.at(-1)?.options).not.toHaveProperty("markdown_text");
		expect(JSON.stringify(calls)).not.toContain(SLACK_COPY.agentFailure);
	});

	it("does not start a new Slack response when the run is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
		const sayCalls: unknown[] = [];
		const client = {
			apiCall: async (method: string, options?: Record<string, unknown>) => {
				calls.push({ method, options: options ?? {} });
				return { ok: true };
			},
		};
		const agent: Pick<DatabuddyAgentClient, "stream"> = {
			async *stream(_run, options) {
				if (options?.abortSignal?.aborted) {
					const error = new Error("aborted");
					error.name = "AbortError";
					throw error;
				}
				yield "Should not post";
			},
		};

		const result = await streamAgentToSlack({
			abortSignal: controller.signal,
			agent,
			client,
			logger: {
				error: () => {},
				warn: () => {},
			},
			run: {
				channelId: "C123",
				messageTs: "171234.567",
				teamId: "T123",
				text: "say something nice",
				threadTs: "171234.567",
				trigger: "app_mention",
				userId: "U123",
			},
			say: async (message) => {
				sayCalls.push(message);
			},
		});

		expect(result).toMatchObject({ aborted: true, ok: false });
		expect(calls).toEqual([]);
		expect(sayCalls).toEqual([]);
	});

	it("does not stream dashboard component JSON into Slack", async () => {
		const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
		const client = {
			apiCall: async (method: string, options?: Record<string, unknown>) => {
				calls.push({ method, options: options ?? {} });
				if (method === "chat.startStream") {
					return { ok: true, ts: "stream_ts" };
				}
				return { ok: true };
			},
		};
		const agent: Pick<DatabuddyAgentClient, "stream"> = {
			async *stream() {
				yield "Here are the top pages:\n";
				yield JSON.stringify({
					type: "data-table",
					title: "Top Pages",
					columns: ["Page", "Visitors"],
					rows: [["/", 1500]],
				});
			},
		};

		await streamAgentToSlack({
			agent,
			client,
			logger: {
				error: () => {},
				warn: () => {},
			},
			run: {
				channelId: "C123",
				messageTs: "171234.567",
				teamId: "T123",
				text: "top pages",
				threadTs: "171234.567",
				trigger: "app_mention",
				userId: "U123",
			},
			say: async () => {},
		});

		const sentText = calls
			.map((call) => call.options.markdown_text)
			.filter((value): value is string => typeof value === "string")
			.join("\n");
		expect(sentText).toContain("*Top Pages*");
		expect(sentText).toContain("1,500");
		expect(sentText).not.toContain('"type"');
		expect(sentText).not.toContain('"rows"');
	});
});
