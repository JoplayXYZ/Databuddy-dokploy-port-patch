import { describe, expect, it } from "bun:test";
import { DatabuddyAgentUserError } from "@databuddy/ai/agent/errors";
import type { DatabuddyAgentClient } from "../agent/agent-client";
import { SLACK_COPY } from "./messages";
import { streamAgentToSlack } from "./respond";
import type { SlackAgentClient } from "./types";

function createStreamClient(startTs = "stream_ts") {
	const calls: Array<{ method: string; options: unknown }> = [];
	const client: Pick<SlackAgentClient, "chat"> = {
		chat: {
			appendStream: async (options) => {
				calls.push({ method: "chat.appendStream", options });
				return { ok: true };
			},
			startStream: async (options) => {
				calls.push({ method: "chat.startStream", options });
				return { ok: true, ts: startTs };
			},
			stopStream: async (options) => {
				calls.push({ method: "chat.stopStream", options });
				return { ok: true };
			},
		},
	};
	return {
		calls,
		client,
	};
}

describe("Databuddy Slack response streaming", () => {
	it("starts streams with answer text, not a loading placeholder", async () => {
		const originalDateNow = Date.now;
		let now = 0;
		const { calls, client } = createStreamClient();
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
		expect(calls[0]?.options).not.toEqual(
			expect.objectContaining({ markdown_text: SLACK_COPY.streamOpening })
		);
		expect(calls.map((call) => call.method)).toEqual([
			"chat.startStream",
			"chat.stopStream",
		]);
	});

	it("does not append a failure message after a partial answer streamed", async () => {
		const { calls, client } = createStreamClient();
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

	it("surfaces user-facing agent errors instead of the generic failure copy", async () => {
		const { calls, client } = createStreamClient();
		const sayCalls: Array<{ text: string; thread_ts?: string }> = [];
		const agent: Pick<DatabuddyAgentClient, "stream"> = {
			async *stream() {
				throw new DatabuddyAgentUserError({
					code: "agent_credits_exhausted",
					message:
						"You're out of Databunny credits this month. Upgrade or wait for the monthly reset.",
				});
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
				text: "top pages",
				threadTs: "171234.567",
				trigger: "app_mention",
				userId: "U123",
			},
			say: async (message) => {
				sayCalls.push(message);
				return { ok: true, ts: "say_ts" };
			},
		});

		expect(result).toMatchObject({
			ok: false,
			responseTs: "say_ts",
			streamed: false,
		});
		expect(calls).toEqual([]);
		expect(sayCalls).toEqual([
			{
				text: "You're out of Databunny credits this month. Upgrade or wait for the monthly reset.",
				thread_ts: "171234.567",
			},
		]);
		expect(sayCalls[0]?.text).not.toBe(SLACK_COPY.agentFailure);
	});

	it("does not start a new Slack response when the run is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const { calls, client } = createStreamClient();
		const sayCalls: unknown[] = [];
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
		const { calls, client } = createStreamClient();
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
			.map((call) => getStringOption(call.options, "markdown_text"))
			.filter((value): value is string => typeof value === "string")
			.join("\n");
		expect(sentText).toContain("*Top Pages*");
		expect(sentText).toContain("1,500");
		expect(sentText).not.toContain('"type"');
		expect(sentText).not.toContain('"rows"');
	});
});

function getStringOption(value: unknown, key: string): string | undefined {
	return isRecord(value) && typeof value[key] === "string"
		? value[key]
		: undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
