export interface RunMcpAgentOptions {
	apiKey: unknown;
	conversationId?: string;
	priorMessages?: Array<{ role: "user" | "assistant"; content: string }>;
	question: string;
	requestHeaders: Headers;
	source?: "mcp" | "slack";
	timezone?: string;
	userId: string | null;
}

export declare function runMcpAgent(
	options: RunMcpAgentOptions
): Promise<string>;

export declare function streamMcpAgentText(
	options: RunMcpAgentOptions
): AsyncGenerator<string>;
