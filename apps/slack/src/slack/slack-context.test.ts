import { describe, expect, it } from "bun:test";
import { createSlackAgentContext } from "./slack-context";

describe("Slack agent context", () => {
	it("reads the current Slack thread through conversations.replies", async () => {
		const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
		const context = createSlackAgentContext(
			{
				apiCall: async (method: string, options?: Record<string, unknown>) => {
					calls.push({ method, options: options ?? {} });
					return {
						ok: true,
						has_more: false,
						messages: [
							{
								text: "launch is Friday",
								thread_ts: "171234.000",
								ts: "171234.001",
								user: "U123",
							},
						],
					};
				},
			},
			{
				channelId: "C123",
				messageTs: "171234.001",
				teamId: "T123",
				text: "what did we decide?",
				threadTs: "171234.000",
				trigger: "app_mention",
				userId: "U123",
			}
		);

		const result = await context?.readCurrentThread?.();

		expect(calls[0]).toEqual({
			method: "conversations.replies",
			options: expect.objectContaining({
				channel: "C123",
				ts: "171234.000",
			}),
		});
		expect(result).toEqual({
			channelId: "C123",
			hasMore: false,
			messages: [
				{
					text: "launch is Friday",
					threadTs: "171234.000",
					ts: "171234.001",
					userId: "U123",
				},
			],
			threadTs: "171234.000",
		});
	});
});
