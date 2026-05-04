import type { AgentBridgeConfig } from "../config";
import { SLACK_COPY } from "../slack/messages";

const DEFAULT_TIMEZONE = "UTC";
const AGENT_REQUEST_TIMEOUT_MS = 120_000;

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
		return text.trim() || SLACK_COPY.noAnswer;
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
				stream: true,
				timezone: DEFAULT_TIMEZONE,
			}),
			headers: {
				Authorization: `Bearer ${context.agentApiKeySecret}`,
				"Content-Type": "application/json",
				"x-databuddy-slack-organization-id": context.organizationId,
				"x-databuddy-slack-team-id": context.teamId,
			},
			method: "POST",
			signal: AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new Error(
				`Databuddy agent API returned ${response.status} ${response.statusText}`.trim()
			);
		}

		if (isPlainTextStream(response)) {
			yield* streamResponseText(response);
			return;
		}

		const payload = (await response.json()) as { answer?: unknown };
		yield typeof payload.answer === "string"
			? payload.answer
			: SLACK_COPY.noAnswer;
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

function isPlainTextStream(response: Response): boolean {
	return (
		Boolean(response.body) &&
		(response.headers.get("content-type") ?? "")
			.toLowerCase()
			.startsWith("text/plain")
	);
}

async function* streamResponseText(response: Response): AsyncGenerator<string> {
	const reader = response.body?.getReader();
	if (!reader) {
		return;
	}

	const decoder = new TextDecoder();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value) {
				yield decoder.decode(value, { stream: true });
			}
		}

		const tail = decoder.decode();
		if (tail) {
			yield tail;
		}
	} finally {
		reader.releaseLock();
	}
}
