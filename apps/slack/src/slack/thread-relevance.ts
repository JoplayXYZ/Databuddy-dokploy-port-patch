import {
	classifySlackThreadReplyRelevance,
	type SlackThreadReplyMessage,
	type SlackThreadReplyRelevance,
} from "@databuddy/ai/agent";
import type { SlackAgentRun } from "@/agent/agent-client";

const MODEL_TIMEOUT_MS = 900;
const MENTION_REGEX = /<@([a-z0-9]+)>/gi;
const WHITESPACE_REGEX = /\s+/g;
const WORD_SEPARATOR_REGEX = /\s+/;
const LEADING_FILLER_REGEX =
	/^(?:(?:sure|ok(?:ay)?|yeah|yep|yes|cool|nice|right|got it|alright|also|and|please)[,!\s]+)+/i;
const LEADING_BOT_ADDRESS_REGEX =
	/^(?:(?:hi|hey|hello|yo)[,!\s]+)?(?:databuddy|bunny)[,:!\s]+/i;
const DIRECT_REQUEST_PATTERN =
	"(?:can you|could you|would you|show me|give me|tell me|check|what(?:'|\\u2019)s (?:my|our|the|your)|whats (?:my|our|the|your)|what is (?:my|our|the|your)|remember|forget|save|clear|pull|find|compare|drill|report|summarize)";
const QUESTION_START_REGEX =
	/^(?:also\s+|and\s+)?(?:how|why|what|where|when|who|which|does|do|is|are|can|could|should|would|will)\b/i;

const OBVIOUS_CHATTER_REGEX =
	/^(hi|hey|hello|yo|lol|lmao|lmfao|haha+|hehe+|ok|okay|k|nice|cool|thanks|thank you|ty|good bunny|good job(?: bunny)?|i dig it|did|he just call u|he just call you|pen jammin|inta stress test)$/i;
const SIDE_COMMENT_REGEX =
	/\b(good stress test|poor bunny|overwhelming the poor bunny|it has memory|full,? permanent memory|where did it get a memory|shared memory|asked it to call me|now that'?s who i am|see if it leaks|i cooked it|i'?ll continue improving|it'?s the uprising|databuddy doesn'?t exist for (?:u|you) yet|i don'?t fully know how slack works)\b/i;
const HUMAN_DIRECTED_REGEX =
	/\b(what do you think|anything we should change|give me some feedback|ask it some shit)\b/i;
const DIRECT_REQUEST_REGEX = new RegExp(
	`^(?:also\\s+|and\\s+)?${DIRECT_REQUEST_PATTERN}\\b`,
	"i"
);
const BOT_DIRECT_REQUEST_REGEX = new RegExp(
	`^(?:databuddy|bunny)[,:\\s]+${DIRECT_REQUEST_PATTERN}\\b`,
	"i"
);
const ANALYTICS_REQUEST_REGEX =
	/\b(dashboard|traffic|visitor|visitors|session|sessions|page|pages|pageview|pageviews|top pages?|revenue|error|errors|event|events|funnel|funnels|goal|goals|conversion|utm|referrer|campaign|link|uptime|latency|bounce|retention|cohort|metric|analytics)\b/i;
const BOT_NAME_REGEX = /\b(databuddy|bunny)\b/i;
const SLACK_SETUP_CONTEXT_REGEX =
	/\b(databuddy|bunny|slack|linear|bind|binding|permission|permissions|scope|scopes|oauth|install|installed|workspace|workspaces|channel|channels|slack connect|app mention|bot|manifest)\b/i;
const BOT_QUESTION_REPLY_REGEX =
	/^(?:yes|yep|yeah|sure|ok(?:ay)?|please|please do|do that|go ahead|sounds good|that one|first one|second one|errors?|mobile|pricing|traffic|top pages?|referrers?|sources?)\b/i;
const THREAD_CONTEXT_QUESTION_REGEX =
	/^(?:also\s+|and\s+)?(?:is that|was that|does that|why|how|what|which|where|when|can you answer that|what should we|which one should we|do you agree|agree)\b/i;
const BOT_ASKED_FOLLOW_UP_REGEX =
	/\b(want me to|should i|shall i|do you want me to|want a|want me|next\?|drill into|pull|check)\b/i;

export type SlackThreadReplyDecisionSource = "fallback" | "model" | "rules";

export interface SlackThreadReplyDecision {
	confidence: number;
	reason: SlackThreadReplyRelevance["reason"];
	shouldReply: boolean;
	source: SlackThreadReplyDecisionSource;
}

export interface SlackThreadReplyGateContext {
	botUserId?: string;
	readThreadMessages?: () => Promise<SlackThreadReplyMessage[]>;
}

export interface SlackThreadReplyGate {
	shouldReply(
		run: SlackAgentRun,
		context: SlackThreadReplyGateContext
	): Promise<SlackThreadReplyDecision>;
}

export const slackThreadReplyGate: SlackThreadReplyGate = {
	shouldReply: shouldReplyToSlackThreadFollowUp,
};

export async function shouldReplyToSlackThreadFollowUp(
	run: SlackAgentRun,
	context: SlackThreadReplyGateContext = {}
): Promise<SlackThreadReplyDecision> {
	const threadMessages = await readThreadMessages(context);
	const rulesDecision = getRulesDecision(run.text, context.botUserId, {
		currentUserId: run.userId,
		threadMessages,
	});
	if (rulesDecision) {
		return rulesDecision;
	}

	const modelDecision = await classifySlackThreadReplyRelevance({
		botUserId: context.botUserId,
		currentUserId: run.userId,
		text: run.text,
		threadMessages,
		timeoutMs: MODEL_TIMEOUT_MS,
	});
	if (modelDecision) {
		return {
			confidence: modelDecision.confidence,
			reason: modelDecision.reason,
			shouldReply: modelDecision.shouldReply,
			source: "model",
		};
	}

	return getFallbackDecision(run.text, context.botUserId, {
		currentUserId: run.userId,
		threadMessages,
	});
}

function getRulesDecision(
	text: string,
	botUserId?: string,
	context: {
		currentUserId?: string;
		threadMessages?: SlackThreadReplyMessage[];
	} = {}
): SlackThreadReplyDecision | null {
	const normalized = normalizeText(text);
	if (!normalized) {
		return decision(false, "side_chatter", 1);
	}
	const requestText = toRequestText(normalized);

	if (mentionsBot(normalized, botUserId)) {
		return decision(true, "bot_mentioned", 1);
	}

	if (
		hasNonBotMention(normalized, botUserId) &&
		HUMAN_DIRECTED_REGEX.test(normalized)
	) {
		return decision(false, "human_to_human", 0.9);
	}

	if (isAnswerToRecentBotQuestion(requestText, botUserId, context)) {
		return decision(true, "direct_request", 0.86);
	}

	if (isContextualThreadQuestion(requestText, botUserId, context)) {
		return decision(
			true,
			ANALYTICS_REQUEST_REGEX.test(getRecentThreadText(context.threadMessages))
				? "analytics_request"
				: "direct_request",
			0.82
		);
	}

	if (OBVIOUS_CHATTER_REGEX.test(normalized)) {
		return decision(false, "side_chatter", 0.95);
	}

	if (SIDE_COMMENT_REGEX.test(normalized)) {
		return decision(false, "side_chatter", 0.9);
	}

	if (
		BOT_NAME_REGEX.test(normalized) &&
		(BOT_DIRECT_REQUEST_REGEX.test(normalized) ||
			QUESTION_START_REGEX.test(requestText) ||
			requestText.includes("?"))
	) {
		return decision(true, "direct_request", 0.85);
	}

	if (
		ANALYTICS_REQUEST_REGEX.test(requestText) &&
		(DIRECT_REQUEST_REGEX.test(requestText) ||
			QUESTION_START_REGEX.test(requestText) ||
			requestText.includes("?"))
	) {
		return decision(true, "analytics_request", 0.9);
	}

	if (isSlackSetupQuestion(requestText)) {
		return decision(true, "direct_request", 0.82);
	}

	if (DIRECT_REQUEST_REGEX.test(requestText)) {
		return decision(true, "direct_request", 0.85);
	}

	if (
		hasNonBotMention(normalized, botUserId) &&
		!mentionsBot(normalized, botUserId) &&
		!BOT_NAME_REGEX.test(normalized)
	) {
		return decision(false, "human_to_human", 0.75);
	}

	if (isShortChatter(normalized)) {
		return decision(false, "side_chatter", 0.8);
	}

	return null;
}

function getFallbackDecision(
	text: string,
	botUserId?: string,
	context: {
		currentUserId?: string;
		threadMessages?: SlackThreadReplyMessage[];
	} = {}
): SlackThreadReplyDecision {
	const normalized = normalizeText(text);
	const requestText = toRequestText(normalized);
	if (mentionsBot(normalized, botUserId)) {
		return decision(true, "bot_mentioned", 0.65, "fallback");
	}
	if (
		DIRECT_REQUEST_REGEX.test(requestText) ||
		isSlackSetupQuestion(requestText)
	) {
		return decision(true, "direct_request", 0.65, "fallback");
	}
	if (ANALYTICS_REQUEST_REGEX.test(requestText) && requestText.includes("?")) {
		return decision(true, "analytics_request", 0.65, "fallback");
	}
	if (
		isAnswerToRecentBotQuestion(requestText, botUserId, context) ||
		isContextualThreadQuestion(requestText, botUserId, context)
	) {
		return decision(true, "direct_request", 0.62, "fallback");
	}

	return decision(
		false,
		isShortChatter(normalized) ? "side_chatter" : "ambiguous",
		0.55,
		"fallback"
	);
}

function decision(
	shouldReply: boolean,
	reason: SlackThreadReplyDecision["reason"],
	confidence: number,
	source: SlackThreadReplyDecisionSource = "rules"
): SlackThreadReplyDecision {
	return {
		confidence,
		reason,
		shouldReply,
		source,
	};
}

async function readThreadMessages(
	context: SlackThreadReplyGateContext
): Promise<SlackThreadReplyMessage[]> {
	try {
		return (await context.readThreadMessages?.()) ?? [];
	} catch {
		return [];
	}
}

function normalizeText(text: string): string {
	return text.replace(WHITESPACE_REGEX, " ").trim().toLowerCase();
}

function toRequestText(text: string): string {
	const withoutFiller = text.replace(LEADING_FILLER_REGEX, "").trim();
	return (
		withoutFiller.replace(LEADING_BOT_ADDRESS_REGEX, "").trim() || withoutFiller
	);
}

function mentionsBot(text: string, botUserId?: string): boolean {
	return Boolean(botUserId && text.includes(`<@${botUserId.toLowerCase()}>`));
}

function hasNonBotMention(text: string, botUserId?: string): boolean {
	for (const match of text.matchAll(MENTION_REGEX)) {
		if (match[1]?.toLowerCase() !== botUserId?.toLowerCase()) {
			return true;
		}
	}
	return false;
}

function isSlackSetupQuestion(text: string): boolean {
	return (
		SLACK_SETUP_CONTEXT_REGEX.test(text) &&
		(QUESTION_START_REGEX.test(text) || text.includes("?"))
	);
}

function isAnswerToRecentBotQuestion(
	text: string,
	botUserId: string | undefined,
	context: {
		currentUserId?: string;
		threadMessages?: SlackThreadReplyMessage[];
	}
): boolean {
	const botMessage = getRecentBotMessage(context.threadMessages, botUserId);
	if (!botMessage) {
		return false;
	}
	return (
		(botMessage.text.includes("?") ||
			BOT_ASKED_FOLLOW_UP_REGEX.test(botMessage.text)) &&
		BOT_QUESTION_REPLY_REGEX.test(text)
	);
}

function isContextualThreadQuestion(
	text: string,
	botUserId: string | undefined,
	context: {
		currentUserId?: string;
		threadMessages?: SlackThreadReplyMessage[];
	}
): boolean {
	if (!(THREAD_CONTEXT_QUESTION_REGEX.test(text) || text.includes("?"))) {
		return false;
	}
	return Boolean(getRecentBotMessage(context.threadMessages, botUserId));
}

function getRecentBotMessage(
	messages: SlackThreadReplyMessage[] | undefined,
	botUserId?: string
): SlackThreadReplyMessage | null {
	if (!(botUserId && messages?.length)) {
		return null;
	}
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.userId?.toLowerCase() === botUserId.toLowerCase()) {
			return {
				...message,
				text: normalizeText(message.text),
			};
		}
	}
	return null;
}

function getRecentThreadText(
	messages: SlackThreadReplyMessage[] | undefined
): string {
	return (messages ?? [])
		.slice(-8)
		.map((message) => message.text)
		.join(" ");
}

function isShortChatter(text: string): boolean {
	return text.split(WORD_SEPARATOR_REGEX).length <= 3 && !text.includes("?");
}
