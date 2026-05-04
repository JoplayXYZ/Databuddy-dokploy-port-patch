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
	agentApiKeyId: string;
	organizationId: string;
	teamId: string;
	websiteId: string;
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

		const response = await fetch(`${this.#config.apiUrl}/v1/agent/chat`, {
			body: JSON.stringify({
				id: createSlackChatId(run),
				messages: [
					{
						id: createSlackMessageId(run),
						parts: [{ text: run.text, type: "text" }],
						role: "user",
					},
				],
				timezone: DEFAULT_TIMEZONE,
				websiteId: context.websiteId,
			}),
			headers: {
				"Content-Type": "application/json",
				"x-databuddy-api-key-id": context.agentApiKeyId,
				"x-databuddy-internal-secret": this.#config.internalSecret,
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

		yield* readAgentStream(response);
	}
}

export function getMissingAgentContextMessage(): string {
	return [
		"Slack is connected, but this channel is not mapped to a Databuddy website yet.",
		"Choose a default website for the Databuddy organization or bind this Slack channel to a website.",
	].join(" ");
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

function createSlackMessageId(run: SlackAgentRun): string {
	return safeId(
		["slack-message", run.messageTs ?? Date.now().toString()].join("-")
	);
}

function safeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

export async function* readAgentStream(
	response: Response
): AsyncGenerator<string> {
	if (!response.body) {
		throw new Error("Databuddy agent response did not include a body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			buffer += decoder.decode();
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const result = drainSseBuffer(buffer);
		buffer = result.remaining;
		yield* result.text;
	}

	yield* drainSseBuffer(`${buffer}\n`).text;
}

function drainSseBuffer(buffer: string): { remaining: string; text: string[] } {
	let newlineIndex = buffer.indexOf("\n");
	let remaining = buffer;
	const text: string[] = [];

	while (newlineIndex !== -1) {
		const line = remaining.slice(0, newlineIndex);
		remaining = remaining.slice(newlineIndex + 1);

		if (line.startsWith("data: ")) {
			const chunk = parseAgentStreamPayload(line.slice(6).trim());
			if (chunk) {
				text.push(chunk);
			}
		}

		newlineIndex = remaining.indexOf("\n");
	}

	return { remaining, text };
}

export function parseAgentStreamPayload(payload: string): string | null {
	if (!(payload && payload !== "[DONE]")) {
		return null;
	}

	let event: unknown;
	try {
		event = JSON.parse(payload);
	} catch {
		return null;
	}
	if (!isRecord(event)) {
		return null;
	}

	switch (event.type) {
		case "text-delta":
		case "content-delta":
			return typeof event.delta === "string" ? event.delta : null;
		default:
			return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
