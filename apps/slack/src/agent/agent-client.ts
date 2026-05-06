import {
	streamDatabuddyAgent,
	type DatabuddyAgentSlackContext,
} from "@databuddy/ai/agent";
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
	agentApiKeyId?: string;
	agentApiKeySecret: string;
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
			slack_agent_api_key_id: context.agentApiKeyId,
		});
		yield* streamDatabuddyAgent({
			abortSignal: options?.abortSignal,
			actor: {
				expectedOrganizationId: context.organizationId,
				secret: context.agentApiKeySecret,
				type: "api_key_secret",
				userId: null,
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
			`Message from ${formatSlackUser(run.userId)}:`,
			run.text,
		].join("\n");
	}

	const lines = followUps.map((followUp, index) => {
		const author = followUp.userId
			? formatSlackUser(followUp.userId)
			: "Slack user";
		return `${index + 1}. ${author}: ${followUp.text}`;
	});

	return [
		context,
		"<slack_follow_ups>",
		"These messages arrived in the same Slack thread while you were already responding. Continue the conversation and answer all follow-ups in order.",
		...lines,
		"</slack_follow_ups>",
	].join("\n");
}

function formatSlackMessageContext(run: SlackAgentRun): string {
	const lines = [
		"<slack_message_context>",
		`Current Slack speaker: ${formatSlackUser(run.userId)}`,
		`Current Slack user id: ${run.userId}`,
		`Slack team id: ${run.teamId ?? "unknown"}`,
		`Slack channel id: ${run.channelId}`,
		`Slack thread ts: ${run.threadTs ?? run.messageTs ?? "unknown"}`,
		`Slack trigger: ${run.trigger}`,
		"Treat the current Slack speaker as the person asking this message. Do not apply another Slack user's saved name, identity, or preferences to them.",
		"For thread follow-ups, answer from the Slack thread when the current message refers to prior context. Only pull fresh analytics when this exact message asks for fresh/current/live data or metrics missing from the thread.",
		"Do not read recent channel messages for a thread follow-up unless the user asks about channel context outside this thread.",
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

function safeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}
