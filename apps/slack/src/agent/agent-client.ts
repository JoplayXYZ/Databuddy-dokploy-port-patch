import { streamDatabuddyAgent } from "@databuddy/ai/agent";
import type { DatabuddyAgentSlackContext } from "@databuddy/ai/agent";
import { SLACK_COPY } from "../slack/messages";

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
			yield getMissingAgentContextMessage();
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
		const conversationId = createSlackChatId(run);
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
			slackContext: run.slackContext,
			source: "slack",
			timezone: DEFAULT_TIMEZONE,
		});
	}
}

export function getMissingAgentContextMessage(): string {
	return SLACK_COPY.missingWorkspace;
}

export function createSlackChatId(run: SlackAgentRun): string {
	return safeId(
		[
			"slack",
			run.teamId ?? "team",
			run.channelId,
			run.threadTs ?? run.messageTs ?? Date.now().toString(),
		].join("-")
	);
}

export function formatSlackAgentInput(run: SlackAgentRun): string {
	const followUps = run.followUpMessages ?? [];
	if (followUps.length === 0) {
		return run.text;
	}

	const lines = followUps.map((followUp, index) => {
		const author = followUp.userId ? `<@${followUp.userId}>` : "Slack user";
		return `${index + 1}. ${author}: ${followUp.text}`;
	});

	return [
		"<slack_follow_ups>",
		"These messages arrived in the same Slack thread while you were already responding. Continue the conversation and answer all follow-ups in order.",
		...lines,
		"</slack_follow_ups>",
	].join("\n");
}

function safeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}
