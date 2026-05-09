import type { DatabuddyAgentSlackContext } from "@databuddy/ai/agent";
import type { ApiKeyRow } from "@databuddy/api-keys/resolve";
import { setActiveSlackLog } from "@/lib/evlog-slack";
import { SLACK_COPY } from "@/slack/messages";

const DEFAULT_TIMEZONE = "UTC";

export type SlackAgentTrigger =
	| "app_mention"
	| "assistant"
	| "direct_message"
	| "thread_follow_up";

export interface SlackFollowUpMessage {
	messageTs?: string;
	text: string;
	userId?: string;
}

export interface SlackAgentRun {
	channelId: string;
	followUpMessages?: SlackFollowUpMessage[];
	messageTs?: string;
	slackContext?: DatabuddyAgentSlackContext | null;
	teamId?: string;
	text: string;
	threadTs?: string;
	trigger: SlackAgentTrigger;
	userId: string;
}

export interface SlackRunContext {
	apiKey: ApiKeyRow;
	organizationId: string;
	teamId: string;
}

export interface SlackRunContextResolver {
	resolve(run: SlackAgentRun): Promise<SlackRunContext | null>;
}

export interface SlackAgentStreamOptions {
	abortSignal?: AbortSignal;
}

export interface SlackAgentRunner {
	stream(
		run: SlackAgentRun,
		context: SlackRunContext,
		options?: SlackAgentStreamOptions
	): AsyncGenerator<string>;
}

export class DatabuddyAgentClient {
	readonly #contexts: SlackRunContextResolver;
	readonly #runner: SlackAgentRunner;

	constructor(
		contexts: SlackRunContextResolver,
		runner: SlackAgentRunner = new SharedDatabuddyAgentRunner()
	) {
		this.#contexts = contexts;
		this.#runner = runner;
	}

	async runToText(run: SlackAgentRun): Promise<string> {
		let text = "";
		for await (const chunk of this.stream(run)) {
			text += chunk;
		}
		return text.trim() || SLACK_COPY.noAnswer;
	}

	async *stream(
		run: SlackAgentRun,
		options?: SlackAgentStreamOptions
	): AsyncGenerator<string> {
		const context = await this.#contexts.resolve(run);
		if (!context) {
			yield getMissingSlackWorkspaceMessage();
			return;
		}
		yield* this.#runner.stream(run, context, options);
	}
}

class SharedDatabuddyAgentRunner implements SlackAgentRunner {
	async *stream(
		run: SlackAgentRun,
		context: SlackRunContext,
		options?: SlackAgentStreamOptions
	): AsyncGenerator<string> {
		const conversationId = createSlackConversationId(run);
		setActiveSlackLog({
			agent_chat_id: conversationId,
			agent_source: "slack",
			organization_id: context.organizationId,
			slack_agent_api_key_id: context.apiKey.id,
		});
		const { streamDatabuddyAgent } = await import("@databuddy/ai/agent");

		yield* streamDatabuddyAgent({
			abortSignal: options?.abortSignal,
			actor: {
				apiKey: context.apiKey,
				type: "api_key",
				userId: context.apiKey.userId,
			},
			conversationId,
			input: formatSlackAgentInput(run),
			memoryUserId: createSlackMemoryUserId(run),
			slackContext: run.slackContext,
			source: "slack",
			timezone: DEFAULT_TIMEZONE,
		});
	}
}

export function getMissingSlackWorkspaceMessage(): string {
	return SLACK_COPY.missingWorkspace;
}

export function createSlackConversationId(run: SlackAgentRun): string {
	return safeId(
		[
			"slack",
			run.teamId ?? "team",
			run.channelId,
			run.threadTs ?? run.messageTs ?? Date.now().toString(),
		].join("-")
	);
}

export function createSlackMemoryUserId(run: SlackAgentRun): string {
	return safeId(["slack", run.teamId ?? "team", run.userId].join("-"));
}

export function formatSlackAgentInput(run: SlackAgentRun): string {
	const followUps = run.followUpMessages ?? [];
	const context = formatSlackMessageContext(run);
	if (followUps.length === 0) {
		return [
			context,
			"<slack_latest_message>",
			`author: ${formatSlackUser(run.userId)}`,
			`author_memory_scope: ${createSlackMemoryUserId(run)}`,
			"text:",
			run.text,
			"</slack_latest_message>",
		].join("\n");
	}

	const lines = followUps.map((followUp, index) => {
		const author = followUp.userId
			? formatSlackUser(followUp.userId)
			: "Slack user";
		const memoryScope = followUp.userId
			? createSlackMemoryUserId({ ...run, userId: followUp.userId })
			: "unknown";
		return [
			`<slack_follow_up index="${index + 1}">`,
			`author: ${author}`,
			`author_memory_scope: ${memoryScope}`,
			"text:",
			followUp.text,
			"</slack_follow_up>",
		].join("\n");
	});

	return [
		context,
		"<slack_follow_ups>",
		"These messages arrived in the same Slack thread while you were already responding. Continue the conversation and answer all follow-ups in order.",
		"Each follow-up has its own author and memory scope. Attribute names/preferences/memories only to that follow-up's author.",
		...lines,
		"</slack_follow_ups>",
	].join("\n");
}

function formatSlackMessageContext(run: SlackAgentRun): string {
	const mentionedUsers = extractSlackMentionedUsers(run.text);
	const otherMentionedUsers = mentionedUsers.filter(
		(userId) => userId !== run.userId
	);
	const lines = [
		"<slack_message_context>",
		`current_speaker: ${formatSlackUser(run.userId)}`,
		`current_speaker_user_id: ${run.userId}`,
		`current_speaker_memory_scope: ${createSlackMemoryUserId(run)}`,
		`slack_team_id: ${run.teamId ?? "unknown"}`,
		`slack_channel_id: ${run.channelId}`,
		`slack_thread_ts: ${run.threadTs ?? run.messageTs ?? "unknown"}`,
		`slack_trigger: ${run.trigger}`,
		`mentioned_slack_users_in_latest_message: ${
			mentionedUsers.length > 0
				? mentionedUsers.map(formatSlackUser).join(", ")
				: "none"
		}`,
		`other_people_mentioned_in_latest_message: ${
			otherMentionedUsers.length > 0
				? otherMentionedUsers.map(formatSlackUser).join(", ")
				: "none"
		}`,
		"Identity rule: the current_speaker is the person asking this message. Do not apply another Slack user's saved name, identity, or preferences to them.",
		"Memory rule: saved memory is scoped to current_speaker_memory_scope. If a different Slack user appears in the thread, treat them as a separate person with separate memory.",
		"Mention rule: mentioned Slack users are usually subjects or addressees, not the current speaker. Do not pretend to be them or use their memory for the current speaker.",
		"Thread rule: for thread follow-ups, answer from the current Slack thread when the latest message refers to prior context. Only pull fresh analytics when this exact message asks for fresh/current/live data or metrics missing from the thread.",
		"Channel rule: do not read recent channel messages for a thread follow-up unless the user asks about channel context outside this thread.",
		"Silence rule: if the latest message is only an insult, dismissal, profanity, or reaction with no actionable request, do not continue the bit; answer with a brief acknowledgement at most.",
		"Hard Slack reply contract: 1-3 short sentences by default; no headings, bold section labels, tables, or multi-paragraph teardown unless explicitly asked. If the user asks for one sentence, say less, or no essay, answer in one sentence.",
		"If the user asks for exact copy or a rewrite, output only the final copy with no preamble.",
		"For Slack UX-copy rewrites, use only the current thread; do not search memory or channel history unless explicitly asked.",
		"</slack_message_context>",
	];
	return lines.join("\n");
}

function formatSlackUser(userId: string): string {
	return `<@${userId}>`;
}

function extractSlackMentionedUsers(text: string): string[] {
	const mentionedUsers: string[] = [];
	for (const token of text.split(" ")) {
		const start = token.indexOf("<@");
		if (start === -1) {
			continue;
		}
		const end = token.indexOf(">", start);
		if (end === -1) {
			continue;
		}
		const userId = token.slice(start + 2, end);
		if (userId && !mentionedUsers.includes(userId)) {
			mentionedUsers.push(userId);
		}
	}
	return mentionedUsers;
}

function safeId(value: string): string {
	return value
		.split("")
		.map((character) => (isSafeIdCharacter(character) ? character : "_"))
		.join("")
		.slice(0, 160);
}

function isSafeIdCharacter(character: string): boolean {
	return (
		(character >= "a" && character <= "z") ||
		(character >= "A" && character <= "Z") ||
		(character >= "0" && character <= "9") ||
		character === "_" ||
		character === "-"
	);
}
