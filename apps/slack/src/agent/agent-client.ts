import { getApiKeyFromHeader } from "@databuddy/api-keys/resolve";
import {
	appendToConversation,
	getConversationHistory,
} from "@databuddy/ai/mcp/conversation-store";
import { streamMcpAgentText } from "@databuddy/ai/mcp/run-agent";
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
		const requestHeaders = createAgentRequestHeaders(context);
		const apiKey = await getApiKeyFromHeader(requestHeaders);
		if (!apiKey) {
			throw new Error("Slack integration API key is invalid or expired.");
		}

		const conversationId = createSlackChatId(run);
		const priorMessages = await getConversationHistory(
			conversationId,
			null,
			apiKey
		);
		let answer = "";

		for await (const chunk of streamMcpAgentText({
			apiKey,
			conversationId,
			priorMessages: priorMessages.length > 0 ? priorMessages : undefined,
			question: run.text,
			requestHeaders,
			source: "slack",
			timezone: DEFAULT_TIMEZONE,
			userId: null,
		})) {
			answer += chunk;
			yield chunk;
		}

		await appendToConversation(
			conversationId,
			null,
			apiKey,
			run.text,
			answer.trim() || SLACK_COPY.noAnswer,
			priorMessages
		).catch(() => {});
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

function createAgentRequestHeaders(context: SlackRunContext): Headers {
	return new Headers({
		Authorization: `Bearer ${context.agentApiKeySecret}`,
		"x-databuddy-slack-organization-id": context.organizationId,
		"x-databuddy-slack-team-id": context.teamId,
	});
}
