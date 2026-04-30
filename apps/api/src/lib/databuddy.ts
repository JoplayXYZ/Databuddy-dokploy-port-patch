import { Databuddy } from "@databuddy/sdk/node";

/**
 * Agent observability: track MCP tool usage and dashboard agent chats.
 * Set DATABUDDY_API_KEY + DATABUDDY_WEBSITE_ID to a website with track:events scope.
 * Single event: agent_activity with action (tool_completed | chat_started | chat_error), source (mcp | dashboard), attribution props.
 */
const apiKey = process.env.DATABUDDY_API_KEY;
const websiteId = process.env.DATABUDDY_WEBSITE_ID;

const client =
	apiKey && websiteId
		? new Databuddy({
				apiKey,
				websiteId,
				source: "api",
				namespace: "agent",
				enableBatching: true,
				debug: process.env.NODE_ENV === "development",
			})
		: null;

const mutationClient =
	apiKey && websiteId
		? new Databuddy({
				apiKey,
				websiteId,
				source: "dashboard",
				enableBatching: true,
				debug: process.env.NODE_ENV === "development",
			})
		: null;

export type AgentEventProperties = Record<string, unknown>;

/**
 * Fire-and-forget agent event tracking. No-ops if DATABUDDY_AGENT_* or DATABUDDY_* env vars are not set.
 * Events appear in the configured website's custom events.
 */
export function trackAgentEvent(
	name: string,
	properties?: AgentEventProperties
): void {
	if (!client) {
		return;
	}

	client
		.track({
			name,
			properties: properties ?? undefined,
		})
		.catch(() => {});
}

export function trackMutationEvent(
	name: string,
	opts: {
		namespace: string;
		sessionId?: string | null;
		anonymousId?: string | null;
		properties?: Record<string, unknown>;
	}
): void {
	if (!mutationClient) {
		return;
	}

	mutationClient
		.track({
			name,
			namespace: opts.namespace,
			sessionId: opts.sessionId ?? undefined,
			anonymousId: opts.anonymousId ?? undefined,
			properties: opts.properties ?? undefined,
		})
		.catch(() => {});
}
