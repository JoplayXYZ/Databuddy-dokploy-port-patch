import type { ApiKeyRow } from "@databuddy/api-keys/resolve";

export type DatabuddyAgentSource = "dashboard" | "mcp" | "slack";

export interface ConversationMessage {
	content: string;
	role: "user" | "assistant";
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

export declare function askDatabuddyAgent(
	options: DatabuddyAgentOptions
): Promise<DatabuddyAgentResult>;

export declare function streamDatabuddyAgent(
	options: DatabuddyAgentOptions
): AsyncGenerator<string>;
