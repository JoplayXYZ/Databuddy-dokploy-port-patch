import { streamDatabuddyAgent } from "@databuddy/ai/agent";
import { SLACK_COPY } from "../slack/messages";

const DEFAULT_TIMEZONE = "UTC";

export type SlackAgentTrigger = "app_mention" | "assistant" | "direct_message";

export interface SlackAgentRun {
	channelId: string;
	messageTs?: string;
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

export interface SlackAgentRunner {
	stream(run: SlackAgentRun, context: SlackRunContext): AsyncGenerator<string>;
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

	async *stream(run: SlackAgentRun): AsyncGenerator<string> {
		const context = await this.#contexts.resolve(run);
		if (!context) {
			yield getMissingAgentContextMessage();
			return;
		}
		yield* this.#runner.stream(run, context);
	}
}

class SharedDatabuddyAgentRunner implements SlackAgentRunner {
	async *stream(
		run: SlackAgentRun,
		context: SlackRunContext
	): AsyncGenerator<string> {
		const conversationId = createSlackChatId(run);
		yield* streamDatabuddyAgent({
			actor: {
				expectedOrganizationId: context.organizationId,
				secret: context.agentApiKeySecret,
				type: "api_key_secret",
				userId: null,
			},
			conversationId,
			input: run.text,
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

function safeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}
