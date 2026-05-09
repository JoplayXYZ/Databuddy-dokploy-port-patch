import { generateObject } from "ai";
import { z } from "zod";
import { isAiGatewayConfigured, models } from "../ai/config/models";

const DEFAULT_TIMEOUT_MS = 900;
const MAX_THREAD_MESSAGES = 30;
const MAX_THREAD_MESSAGE_CHARS = 1000;

const SlackThreadReplyRelevanceSchema = z.object({
	confidence: z.number().min(0).max(1),
	reason: z
		.enum([
			"bot_mentioned",
			"direct_request",
			"analytics_request",
			"human_to_human",
			"side_chatter",
			"ambiguous",
		])
		.describe("Short reason for the routing decision."),
	shouldReply: z.boolean(),
});

export type SlackThreadReplyRelevance = z.infer<
	typeof SlackThreadReplyRelevanceSchema
>;

export interface SlackThreadReplyMessage {
	authorName?: string;
	text: string;
	ts?: string;
	userId?: string;
}

export interface SlackThreadReplyRelevanceInput {
	botUserId?: string;
	currentUserId?: string;
	text: string;
	threadMessages?: SlackThreadReplyMessage[];
	timeoutMs?: number;
}

export async function classifySlackThreadReplyRelevance({
	botUserId,
	currentUserId,
	text,
	threadMessages,
	timeoutMs = DEFAULT_TIMEOUT_MS,
}: SlackThreadReplyRelevanceInput): Promise<SlackThreadReplyRelevance | null> {
	if (!isAiGatewayConfigured) {
		return null;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const result = await generateObject({
			abortSignal: controller.signal,
			maxRetries: 0,
			model: models.quick,
			schema: SlackThreadReplyRelevanceSchema,
			system:
				"Classify whether Databuddy should answer the latest Slack Message. Thread context is context only; decide on Message. shouldReply=true if Message mentions the bot, asks/continues a request, asks analytics/data/product help, or answers Databuddy's previous clarification/follow-up (including short values like both, first one, landing page, yes). shouldReply=false for jokes, thanks, chatter, status comments, or messages to another human. reason=bot_mentioned only if Message contains the bot mention token.",
			prompt: [
				`Bot mention token: ${botUserId ? `<@${botUserId}>` : "unknown"}`,
				`Latest message author: ${currentUserId ? `<@${currentUserId}>` : "unknown"}`,
				formatThreadMessages(threadMessages),
				"Message:",
				text,
			].join("\n"),
		});

		return result.object;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function formatThreadMessages(
	messages: SlackThreadReplyMessage[] = []
): string {
	const recentMessages = messages.slice(-MAX_THREAD_MESSAGES);
	if (recentMessages.length === 0) {
		return "Thread context: unavailable";
	}

	return [
		"Thread context:",
		...recentMessages.map((message, index) => {
			const author = message.userId
				? `<@${message.userId}>`
				: (message.authorName ?? "unknown");
			const text = message.text
				.replaceAll("\n", " ")
				.replaceAll("\r", " ")
				.replaceAll("\t", " ")
				.split(" ")
				.filter(Boolean)
				.join(" ")
				.trim()
				.slice(0, MAX_THREAD_MESSAGE_CHARS);
			return `${index + 1}. ${author}: ${text}`;
		}),
	].join("\n");
}
