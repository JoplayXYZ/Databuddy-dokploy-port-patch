import { describe, expect, it } from "bun:test";
import type { RequestLogger } from "evlog";
import {
	addSlackResponseFeedbackReactions,
	classifySlackReactionSentiment,
} from "./feedback";
import { SLACK_COPY } from "./messages";

describe("Slack feedback reactions", () => {
	it("classifies explicit positive reactions", () => {
		expect(classifySlackReactionSentiment("+1")).toBe("positive");
		expect(classifySlackReactionSentiment(":thumbsup:")).toBe("positive");
		expect(classifySlackReactionSentiment("rocket")).toBe("positive");
	});

	it("classifies explicit negative reactions", () => {
		expect(classifySlackReactionSentiment("-1")).toBe("negative");
		expect(classifySlackReactionSentiment(":thumbsdown:")).toBe("negative");
		expect(classifySlackReactionSentiment("confused")).toBe("negative");
	});

	it("keeps unmapped reactions neutral", () => {
		expect(classifySlackReactionSentiment("eyes")).toBe("neutral");
	});

	it("adds positive and negative feedback reactions to bot responses", async () => {
		const added: Array<{ name?: string; timestamp?: string }> = [];
		const logFields: Record<string, unknown>[] = [];

		await addSlackResponseFeedbackReactions({
			channelId: "C123",
			client: {
				reactions: {
					add: async (args) => {
						added.push(args);
						return { ok: true };
					},
				},
			},
			eventLog: {
				set: (fields: Record<string, unknown>) => logFields.push(fields),
			} as unknown as RequestLogger,
			logger: {
				error: () => {},
				warn: () => {},
			},
			messageTs: "1777924065.843609",
		});

		expect(added.map((reaction) => reaction.name)).toEqual([
			...SLACK_COPY.feedbackReactions,
		]);
		expect(
			added.every((reaction) => reaction.timestamp === "1777924065.843609")
		).toBe(true);
		expect(logFields).toContainEqual(
			expect.objectContaining({
				slack_feedback_reactions_added: SLACK_COPY.feedbackReactions.length,
			})
		);
	});
});
