import type { AgentBridgeConfig } from "../config";

const DEFAULT_TIMEZONE = "UTC";

export type SlackAgentTrigger =
	| "app_mention"
	| "assistant"
	| "direct_message"
	| "slash_command";

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

export class DatabuddyAgentClient {
	readonly #config: AgentBridgeConfig;
	readonly #contexts: SlackRunContextResolver;

	constructor(config: AgentBridgeConfig, contexts: SlackRunContextResolver) {
		this.#config = config;
		this.#contexts = contexts;
	}

	async runToText(run: SlackAgentRun): Promise<string> {
		let text = "";
		for await (const chunk of this.stream(run)) {
			text += chunk;
		}
		return text.trim() || "I could not produce a response for that request.";
	}

	async *stream(run: SlackAgentRun): AsyncGenerator<string> {
		const context = await this.#contexts.resolve(run);
		if (!context) {
			yield getMissingAgentContextMessage();
			return;
		}

		const response = await fetch(`${this.#config.apiUrl}/v1/agent/ask`, {
			body: JSON.stringify({
				id: createSlackChatId(run),
				question: run.text,
				timezone: DEFAULT_TIMEZONE,
			}),
			headers: {
				Authorization: `Bearer ${context.agentApiKeySecret}`,
				"Content-Type": "application/json",
				"x-databuddy-slack-organization-id": context.organizationId,
				"x-databuddy-slack-team-id": context.teamId,
			},
			method: "POST",
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(
				`Databuddy agent API returned ${response.status}: ${body.slice(0, 500)}`
			);
		}

		const payload = (await response.json()) as { answer?: unknown };
		yield typeof payload.answer === "string"
			? payload.answer
			: "No answer was generated.";
	}
}

export function getMissingAgentContextMessage(): string {
	return "This Slack workspace is not connected to a Databuddy organization yet.";
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
