import { describe, expect, it } from "bun:test";
import type { DatabuddyAgentClient } from "../agent/agent-client";
import { SLACK_COPY } from "./messages";
import { streamAgentToSlack } from "./respond";

describe("Databuddy Slack response streaming", () => {
	it("starts streams with visible text before the agent yields", async () => {
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
				yield "Traffic is up 12%.";
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
				text: "What changed?",
				threadTs: "171234.567",
				trigger: "app_mention",
				userId: "U123",
			},
			say: async () => {},
		});

		expect(result).toMatchObject({ ok: true, streamed: true });
		expect(calls[0]).toEqual({
			method: "chat.startStream",
			options: expect.objectContaining({
				markdown_text: SLACK_COPY.streamOpening,
			}),
		});
		expect(calls.map((call) => call.method)).toEqual([
			"chat.startStream",
			"chat.appendStream",
			"chat.stopStream",
		]);
	});
});
