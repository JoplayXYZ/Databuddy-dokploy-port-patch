import { resolveApiKey, type ApiKeyRow } from "@databuddy/api-keys/resolve";
import {
	appendToConversation,
	getConversationHistory,
	type ConversationMessage,
} from "../ai/mcp/conversation-store";
import { runMcpAgent, streamMcpAgentText } from "../ai/mcp/run-agent";

export type { ConversationMessage } from "../ai/mcp/conversation-store";

export type DatabuddyAgentSource = "dashboard" | "mcp" | "slack";

export type DatabuddyAgentActor =
	| {
			apiKey: ApiKeyRow;
			requestHeaders?: Headers;
			type: "api_key";
			userId?: string | null;
	  }
	| {
			expectedOrganizationId?: string | null;
			requestHeaders?: Headers;
			secret: string;
			type: "api_key_secret";
			userId?: string | null;
	  }
	| {
			requestHeaders: Headers;
			type: "session";
			userId: string;
	  };

export interface DatabuddyAgentOptions {
	actor: DatabuddyAgentActor;
	conversationId?: string;
	history?: ConversationMessage[];
	input: string;
	persistConversation?: boolean;
	source?: DatabuddyAgentSource;
	timeoutMs?: number;
	timezone?: string;
}

export interface DatabuddyAgentResult {
	answer: string;
	conversationId: string;
}

interface ResolvedAgentActor {
	apiKey: ApiKeyRow | null;
	requestHeaders: Headers;
	userId: string | null;
}

export async function askDatabuddyAgent(
	options: DatabuddyAgentOptions
): Promise<DatabuddyAgentResult> {
	const prepared = await prepareDatabuddyAgentCall(options);
	const answer = await runMcpAgent({
		apiKey: prepared.actor.apiKey,
		conversationId: prepared.conversationId,
		priorMessages: prepared.history,
		question: options.input,
		requestHeaders: prepared.actor.requestHeaders,
		source: prepared.source,
		timeoutMs: options.timeoutMs,
		timezone: options.timezone,
		userId: prepared.actor.userId,
	});

	await persistAgentConversation(options, prepared, answer);

	return { answer, conversationId: prepared.conversationId };
}

export async function* streamDatabuddyAgent(
	options: DatabuddyAgentOptions
): AsyncGenerator<string> {
	const prepared = await prepareDatabuddyAgentCall(options);
	let answer = "";

	for await (const chunk of streamMcpAgentText({
		apiKey: prepared.actor.apiKey,
		conversationId: prepared.conversationId,
		priorMessages: prepared.history,
		question: options.input,
		requestHeaders: prepared.actor.requestHeaders,
		source: prepared.source,
		timeoutMs: options.timeoutMs,
		timezone: options.timezone,
		userId: prepared.actor.userId,
	})) {
		answer += chunk;
		yield chunk;
	}

	await persistAgentConversation(options, prepared, answer);
}

async function prepareDatabuddyAgentCall(options: DatabuddyAgentOptions) {
	const actor = await resolveDatabuddyAgentActor(options.actor);
	const conversationId = options.conversationId ?? crypto.randomUUID();
	const history =
		options.history ??
		(await getConversationHistory(conversationId, actor.userId, actor.apiKey));

	return {
		actor,
		conversationId,
		history: history.length > 0 ? history : undefined,
		source: options.source ?? "mcp",
	};
}

async function resolveDatabuddyAgentActor(
	actor: DatabuddyAgentActor
): Promise<ResolvedAgentActor> {
	if (actor.type === "session") {
		return {
			apiKey: null,
			requestHeaders: actor.requestHeaders,
			userId: actor.userId,
		};
	}

	if (actor.type === "api_key") {
		return {
			apiKey: actor.apiKey,
			requestHeaders: actor.requestHeaders ?? new Headers(),
			userId: "userId" in actor ? (actor.userId ?? null) : actor.apiKey.userId,
		};
	}

	const requestHeaders =
		actor.requestHeaders ?? createApiKeyHeaders(actor.secret);
	const result = await resolveApiKey(requestHeaders);
	if (!result.key) {
		throw new Error(`Databuddy API key is ${result.outcome}.`);
	}
	if (
		actor.expectedOrganizationId &&
		result.key.organizationId !== actor.expectedOrganizationId
	) {
		throw new Error("Databuddy API key does not belong to this organization.");
	}

	return {
		apiKey: result.key,
		requestHeaders,
		userId: "userId" in actor ? (actor.userId ?? null) : result.key.userId,
	};
}

async function persistAgentConversation(
	options: DatabuddyAgentOptions,
	prepared: Awaited<ReturnType<typeof prepareDatabuddyAgentCall>>,
	answer: string
): Promise<void> {
	if (options.persistConversation === false) {
		return;
	}

	await appendToConversation(
		prepared.conversationId,
		prepared.actor.userId,
		prepared.actor.apiKey,
		options.input,
		answer.trim() || "No response generated.",
		prepared.history
	);
}

function createApiKeyHeaders(secret: string): Headers {
	return new Headers({ Authorization: `Bearer ${secret}` });
}
