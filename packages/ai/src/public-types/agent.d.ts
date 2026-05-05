import type { ApiKeyRow } from "@databuddy/api-keys/resolve";

export type DatabuddyAgentSource = "dashboard" | "mcp" | "slack";

export interface ConversationMessage {
	content: string;
	role: "user" | "assistant";
}

export interface DatabuddyAgentSlackMessage {
	authorName?: string;
	text: string;
	threadTs?: string;
	ts?: string;
	userId?: string;
}

export interface DatabuddyAgentSlackThreadResult {
	channelId: string;
	hasMore?: boolean;
	messages: DatabuddyAgentSlackMessage[];
	threadTs: string;
}

export interface DatabuddyAgentSlackChannelHistoryResult {
	channelId: string;
	hasMore?: boolean;
	messages: DatabuddyAgentSlackMessage[];
}

export interface DatabuddyAgentSlackContext {
	readCurrentThread?: () => Promise<DatabuddyAgentSlackThreadResult>;
	readRecentChannelMessages?: (input: {
		limit?: number;
	}) => Promise<DatabuddyAgentSlackChannelHistoryResult>;
}

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
	abortSignal?: AbortSignal;
	actor: DatabuddyAgentActor;
	conversationId?: string;
	history?: ConversationMessage[];
	input: string;
	modelOverride?: string | null;
	persistConversation?: boolean;
	slackContext?: DatabuddyAgentSlackContext | null;
	source?: DatabuddyAgentSource;
	timeoutMs?: number;
	timezone?: string;
	websiteDomain?: string | null;
	websiteId?: string | null;
}

export interface DatabuddyAgentResult {
	answer: string;
	conversationId: string;
}

export interface DatabuddyAgentToolTrace {
	index: number;
	input: unknown;
	name: string;
	output: unknown;
}

export interface DatabuddyAgentTraceResult extends DatabuddyAgentResult {
	steps: number;
	toolCalls: DatabuddyAgentToolTrace[];
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens?: number;
	};
}

export declare function askDatabuddyAgent(
	options: DatabuddyAgentOptions
): Promise<DatabuddyAgentResult>;

export declare function traceDatabuddyAgent(
	options: DatabuddyAgentOptions
): Promise<DatabuddyAgentTraceResult>;

export declare function streamDatabuddyAgent(
	options: DatabuddyAgentOptions
): AsyncGenerator<string>;
