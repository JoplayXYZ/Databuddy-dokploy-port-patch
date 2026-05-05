import { describe, expect, it, mock } from "bun:test";
import type { SlackAgentRun, SlackRunContext } from "./agent-client";

mock.module("@databuddy/ai/agent", () => ({
	streamDatabuddyAgent: async function* () {
		yield "";
	},
}));

const {
	createSlackChatId,
	DatabuddyAgentClient,
	formatSlackAgentInput,
} = await import("./agent-client");

describe("Databuddy Slack agent client", () => {
	it("creates stable Slack-scoped chat ids", () => {
		expect(
			createSlackChatId({
				channelId: "C123",
				messageTs: "171234.567",
				teamId: "T123",
				text: "hello",
				threadTs: "171234.000",
				trigger: "app_mention",
				userId: "U123",
			})
		).toBe("slack-T123-C123-171234_000");
	});

	it("passes resolved org integration context to the shared Databuddy agent runner", async () => {
		const captured: {
			context?: SlackRunContext;
			run?: SlackAgentRun;
		} = {};
		const client = new DatabuddyAgentClient(
			{
				resolve: async () => ({
					agentApiKeySecret: "dbdy_secret",
					organizationId: "org_123",
					teamId: "T123",
				}),
			},
			{
				async *stream(run, context) {
					captured.run = run;
					captured.context = context;
					yield "Done";
				},
			}
		);

		const answer = await client.runToText({
			channelId: "C123",
			teamId: "T123",
			text: "Summarize traffic",
			trigger: "direct_message",
			userId: "U123",
		});

		expect(answer).toBe("Done");
		expect(captured.run?.text).toBe("Summarize traffic");
		expect(captured.context).toEqual({
			agentApiKeySecret: "dbdy_secret",
			organizationId: "org_123",
			teamId: "T123",
		});
	});

	it("passes through chunks from the shared Databuddy agent runner", async () => {
		const client = new DatabuddyAgentClient(
			{
				resolve: async () => ({
					agentApiKeySecret: "dbdy_secret",
					organizationId: "org_123",
					teamId: "T123",
				}),
			},
			{
				async *stream() {
					yield "Hello ";
					yield "from stream";
				},
			}
		);

		const chunks: string[] = [];
		for await (const chunk of client.stream({
			channelId: "C123",
			teamId: "T123",
			text: "Summarize traffic",
			trigger: "direct_message",
			userId: "U123",
		})) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual(["Hello ", "from stream"]);
	});

	it("formats queued Slack follow-ups as an ordered continuation", () => {
		const input = formatSlackAgentInput({
			channelId: "C123",
			followUpMessages: [
				{ messageTs: "171234.568", text: "also check referrers", userId: "U1" },
				{ messageTs: "171234.569", text: "and compare mobile", userId: "U2" },
			],
			teamId: "T123",
			text: "also check referrers\nand compare mobile",
			threadTs: "171234.000",
			trigger: "thread_follow_up",
			userId: "U2",
		});

		expect(input).toContain("<slack_follow_ups>");
		expect(input).toContain("1. <@U1>: also check referrers");
		expect(input).toContain("2. <@U2>: and compare mobile");
		expect(input).toContain("</slack_follow_ups>");
	});

	it("explains missing organization context when no Slack installation resolves", async () => {
		const client = new DatabuddyAgentClient(
			{
				resolve: async () => null,
			}
		);

		const answer = await client.runToText({
			channelId: "C123",
			teamId: "T123",
			text: "Summarize traffic",
			trigger: "direct_message",
			userId: "U123",
		});

		expect(answer).toBe(
			"Databuddy is not connected to this Slack workspace yet. Open Databuddy organization settings -> Integrations -> Slack, connect the workspace, then run `/bind` in this channel."
		);
	});
});
