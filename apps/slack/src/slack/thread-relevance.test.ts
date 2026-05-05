import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
	SlackThreadReplyMessage,
	SlackThreadReplyRelevance,
	SlackThreadReplyRelevanceInput,
} from "@databuddy/ai/agent";
import type { SlackAgentRun } from "../agent/agent-client";

let capturedModelInput: SlackThreadReplyRelevanceInput | null = null;
let modelDecision: SlackThreadReplyRelevance | null = null;

mock.module("@databuddy/ai/agent", () => ({
	classifySlackThreadReplyRelevance: async (
		input: SlackThreadReplyRelevanceInput
	) => {
		capturedModelInput = input;
		return modelDecision;
	},
}));

const { shouldReplyToSlackThreadFollowUp } = await import("./thread-relevance");

const BASE_RUN: SlackAgentRun = {
	channelId: "C123",
	messageTs: "171234.568",
	teamId: "T123",
	text: "",
	threadTs: "171234.000",
	trigger: "thread_follow_up",
	userId: "U123",
};

function createRun(text: string): SlackAgentRun {
	return { ...BASE_RUN, text };
}

async function decide(text: string) {
	return shouldReplyToSlackThreadFollowUp(createRun(text), {
		botUserId: "UBOT",
	});
}

async function decideWithThread(
	text: string,
	threadMessages: SlackThreadReplyMessage[]
) {
	return shouldReplyToSlackThreadFollowUp(createRun(text), {
		botUserId: "UBOT",
		readThreadMessages: async () => threadMessages,
	});
}

describe("Slack thread reply relevance", () => {
	beforeEach(() => {
		capturedModelInput = null;
		modelDecision = null;
	});

	it("allows explicit bot mentions", async () => {
		await expect(decide("<@UBOT> what now?")).resolves.toMatchObject({
			reason: "bot_mentioned",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows analytics follow-up questions", async () => {
		await expect(decide("What's my top page today?")).resolves.toMatchObject({
			reason: "analytics_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows affirmative analytics follow-ups without a mention", async () => {
		await expect(decide("sure, what's our top pages")).resolves.toMatchObject({
			reason: "analytics_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows requests addressed by bot name", async () => {
		await expect(
			decide("bunny can you remember that the demo pages are noisy?")
		).resolves.toMatchObject({
			reason: "direct_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows conversational questions addressed to the bot by name", async () => {
		await expect(decide("do you agree databuddy?")).resolves.toMatchObject({
			reason: "direct_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows Slack setup questions without needing the model gate", async () => {
		await expect(
			decide("how does linear just work without bind")
		).resolves.toMatchObject({
			reason: "direct_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("allows terse fix requests", async () => {
		await expect(decide("can you fix it")).resolves.toMatchObject({
			reason: "direct_request",
			shouldReply: true,
			source: "rules",
		});
	});

	it("ignores short side chatter", async () => {
		await expect(decide("He just call u")).resolves.toMatchObject({
			reason: "side_chatter",
			shouldReply: false,
			source: "rules",
		});
	});

	it("ignores human-directed product feedback prompts", async () => {
		await expect(
			decide("what do you think <@UQ>, anything we should change?")
		).resolves.toMatchObject({
			reason: "human_to_human",
			shouldReply: false,
			source: "rules",
		});
	});

	it("ignores meta reactions about the bot", async () => {
		await expect(decide("WHERE DID IT GET A MEMORY?")).resolves.toMatchObject({
			reason: "side_chatter",
			shouldReply: false,
			source: "rules",
		});
	});

	it("ignores Slack setup commentary that is not a question", async () => {
		await expect(
			decide("yea databuddy doesn't exist for u yet")
		).resolves.toMatchObject({
			reason: "side_chatter",
			shouldReply: false,
			source: "rules",
		});
	});

	it("ignores questions addressed to another human", async () => {
		await expect(decide("whta model is it <@UISSA>")).resolves.toMatchObject({
			reason: "human_to_human",
			shouldReply: false,
			source: "rules",
		});
	});

	it("ignores memory and leak-test commentary", async () => {
		await expect(
			decide("it also has full, permanent memory")
		).resolves.toMatchObject({
			reason: "side_chatter",
			shouldReply: false,
			source: "rules",
		});
		await expect(
			decide("try ask about our analytics lol, see if it leaks")
		).resolves.toMatchObject({
			reason: "side_chatter",
			shouldReply: false,
			source: "rules",
		});
	});

	it("uses a routing reason when falling back without the model", async () => {
		await expect(decide("this probably belongs in a separate test")).resolves
			.toMatchObject({
				reason: "ambiguous",
				shouldReply: false,
				source: "fallback",
			});
	});

	it("uses thread context for ambiguous conversational continuations", async () => {
		await expect(
			decideWithThread("yes please do that", [
				{
					text: "Want me to pull the top pages next?",
					userId: "UBOT",
				},
				{
					text: "yes please do that",
					userId: "U123",
				},
			])
		).resolves.toMatchObject({
			reason: "direct_request",
			shouldReply: true,
			source: "rules",
		});
		expect(capturedModelInput).toBeNull();
	});
});
