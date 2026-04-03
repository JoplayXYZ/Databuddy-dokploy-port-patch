import type {
	LanguageModel,
	StopCondition,
	SystemModelMessage,
	ToolSet,
} from "ai";

export interface AgentContext {
	userId: string;
	websiteId: string;
	websiteDomain: string;
	timezone: string;
	chatId: string;
	requestHeaders?: Headers;
}

export type AgentType =
	| "triage"
	| "analytics"
	| "reflection"
	| "reflection-max";

export interface AgentConfig {
	model: LanguageModel;
	system: SystemModelMessage;
	tools: ToolSet;
	stopWhen: StopCondition<ToolSet>;
	temperature: number;
	providerOptions?: Record<string, Record<string, unknown>>;
	experimental_context?: unknown;
}
