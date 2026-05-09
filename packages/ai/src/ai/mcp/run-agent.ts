import {
	formatMemoryForPrompt,
	getMemoryContext,
	isMemoryEnabled,
	storeConversation,
} from "../../lib/supermemory";
import type { ApiKeyRow } from "@databuddy/api-keys/resolve";
import type { LanguageModelUsage } from "ai";
import { ToolLoopAgent } from "ai";
import { DatabuddyAgentUserError } from "../../agent/errors";
import { getAILogger } from "../../lib/ai-logger";
import { mergeWideEvent } from "../../lib/tracing";
import {
	ensureAgentCreditsAvailable,
	resolveAgentBillingCustomerId,
	trackAgentUsageAndBill,
} from "../agents/execution";
import { createMcpAgentConfig } from "../agents/mcp";
import { getDefaultAgentModelId } from "../config/models";
import type { AppMutationMode, AppToolMode } from "../config/context";
import type { DatabuddyAgentSlackContext } from "./slack-context";

const DEFAULT_MCP_AGENT_TIMEOUT_MS = 45_000;
export type AgentBillingMode = "bill" | "skip";

export interface RunMcpAgentOptions {
	abortSignal?: AbortSignal;
	apiKey: ApiKeyRow | null;
	billingMode?: AgentBillingMode;
	conversationId?: string;
	memoryUserId?: string | null;
	modelOverride?: string | null;
	mutationMode?: AppMutationMode;
	priorMessages?: Array<{ role: "user" | "assistant"; content: string }>;
	question: string;
	requestHeaders: Headers;
	slackContext?: DatabuddyAgentSlackContext | null;
	source?: "dashboard" | "mcp" | "slack";
	storeMemory?: boolean;
	timeoutMs?: number;
	timezone?: string;
	toolMode?: AppToolMode;
	userId: string | null;
	websiteDomain?: string | null;
	websiteId?: string | null;
}

export interface McpAgentToolTrace {
	index: number;
	input: unknown;
	name: string;
	output: unknown;
}

export interface RunMcpAgentTraceResult {
	answer: string;
	steps: number;
	toolCalls: McpAgentToolTrace[];
	usage: LanguageModelUsage;
}

export async function runMcpAgent(
	options: RunMcpAgentOptions
): Promise<string> {
	const prepared = await prepareMcpAgentRun(options);
	const abort = createRunAbortController(options);

	try {
		const result = await prepared.agent.generate({
			messages: prepared.messages,
			abortSignal: abort.signal,
		});

		const usage = (result as { usage?: LanguageModelUsage }).usage;
		if (usage) {
			await trackPreparedUsage(prepared, usage);
		}

		const answer = result.text ?? "No response generated.";
		if (options.storeMemory !== false) {
			storePreparedConversation(prepared, options.question, answer);
		}

		return answer;
	} finally {
		abort.cleanup();
	}
}

export async function runMcpAgentWithTrace(
	options: RunMcpAgentOptions
): Promise<RunMcpAgentTraceResult> {
	const prepared = await prepareMcpAgentRun(options);
	const abort = createRunAbortController(options);

	try {
		const result = await prepared.agent.generate({
			messages: prepared.messages,
			abortSignal: abort.signal,
		});

		await trackPreparedUsage(prepared, result.totalUsage);
		const answer = result.text ?? "No response generated.";
		if (options.storeMemory !== false) {
			storePreparedConversation(prepared, options.question, answer);
		}

		return {
			answer,
			steps: result.steps.length,
			toolCalls: collectToolTrace(result.steps),
			usage: result.totalUsage,
		};
	} finally {
		abort.cleanup();
	}
}

export async function* streamMcpAgentText(
	options: RunMcpAgentOptions
): AsyncGenerator<string> {
	const prepared = await prepareMcpAgentRun(options);
	const abort = createRunAbortController(options);

	try {
		const result = await prepared.agent.stream({
			messages: prepared.messages,
			abortSignal: abort.signal,
		});
		let answer = "";

		for await (const chunk of result.textStream) {
			answer += chunk;
			yield chunk;
		}

		const usage = await result.totalUsage;
		await trackPreparedUsage(prepared, usage);
		if (options.storeMemory !== false) {
			storePreparedConversation(
				prepared,
				options.question,
				answer.trim() || "No response generated."
			);
		}
	} finally {
		abort.cleanup();
	}
}

function createRunAbortController(options: RunMcpAgentOptions): {
	cleanup: () => void;
	signal: AbortSignal;
} {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), getTimeoutMs(options));
	const externalSignal = options.abortSignal;
	const abortFromExternalSignal = () => {
		controller.abort(externalSignal?.reason);
	};

	if (externalSignal?.aborted) {
		abortFromExternalSignal();
	} else {
		externalSignal?.addEventListener("abort", abortFromExternalSignal, {
			once: true,
		});
	}

	return {
		cleanup: () => {
			clearTimeout(timeout);
			externalSignal?.removeEventListener("abort", abortFromExternalSignal);
		},
		signal: controller.signal,
	};
}

async function prepareMcpAgentRun(options: RunMcpAgentOptions) {
	const sessionId = options.conversationId ?? crypto.randomUUID();
	const mcpUserId = options.userId ?? options.apiKey?.userId ?? null;
	const memoryUserId = options.memoryUserId ?? mcpUserId;
	const organizationId = options.apiKey?.organizationId ?? null;
	const source = options.source ?? "mcp";
	const selectedModelId =
		options.modelOverride ?? getDefaultAgentModelId(source);

	const apiKeyId =
		options.apiKey &&
		typeof options.apiKey === "object" &&
		"id" in options.apiKey
			? (options.apiKey as { id: string }).id
			: null;

	const billingCustomerId =
		options.billingMode === "skip"
			? null
			: await resolveAgentBillingCustomerId({
					userId: mcpUserId,
					apiKey: options.apiKey,
					organizationId,
				});
	mergeWideEvent({
		agent_billing_mode: options.billingMode === "skip" ? "skip" : "bill",
	});

	if (
		options.billingMode !== "skip" &&
		!(await ensureAgentCreditsAvailable(billingCustomerId))
	) {
		throw new DatabuddyAgentUserError({
			code: "agent_credits_exhausted",
			message:
				"You're out of Databunny credits this month. Upgrade or wait for the monthly reset.",
		});
	}

	const [config, memoryCtx] = await Promise.all([
		Promise.resolve(
			createMcpAgentConfig({
				billingCustomerId,
				requestHeaders: options.requestHeaders,
				apiKey: options.apiKey,
				userId: mcpUserId,
				timezone: options.timezone,
				chatId: sessionId,
				modelOverride: options.modelOverride,
				memoryUserId,
				mutationMode: options.mutationMode,
				organizationId,
				slackContext: options.slackContext,
				source,
				toolMode: options.toolMode,
				websiteDomain: options.websiteDomain,
				websiteId: options.websiteId,
			})
		),
		isMemoryEnabled()
			? getMemoryContext(options.question, memoryUserId, apiKeyId)
			: Promise.resolve(null),
	]);

	const memoryBlock = memoryCtx ? formatMemoryForPrompt(memoryCtx) : "";
	const instructions = config.system;

	const mcpTelemetryMetadata: Record<string, string> = {
		source,
		authType: options.apiKey ? "api_key" : "session",
		timezone: options.timezone ?? "UTC",
		"tcc.conversational": "true",
	};
	if (mcpUserId) {
		mcpTelemetryMetadata.userId = mcpUserId;
	}
	if (options.apiKey?.organizationId) {
		mcpTelemetryMetadata.organizationId = options.apiKey.organizationId;
	}
	mcpTelemetryMetadata["tcc.sessionId"] = sessionId;

	const ai = getAILogger();
	const agent = new ToolLoopAgent({
		model: ai.wrap(config.model),
		instructions,
		tools: config.tools,
		stopWhen: config.stopWhen,
		temperature: config.temperature,
		experimental_context: config.experimental_context,
		experimental_telemetry: {
			isEnabled: true,
			functionId: `databuddy.${source}.ask`,
			metadata: mcpTelemetryMetadata,
		},
	});

	const questionContent = memoryBlock
		? `<context>\n${memoryBlock}\n</context>\n\n${options.question}`
		: options.question;

	const messages =
		options.priorMessages && options.priorMessages.length > 0
			? [
					...options.priorMessages,
					{ role: "user" as const, content: questionContent },
				]
			: [{ role: "user" as const, content: questionContent }];

	return {
		agent,
		apiKeyId,
		billingCustomerId,
		memoryUserId,
		mcpUserId,
		messages,
		modelId: selectedModelId,
		organizationId,
		sessionId,
		source,
		websiteDomain: options.websiteDomain ?? undefined,
		websiteId: options.websiteId ?? undefined,
	};
}

async function trackPreparedUsage(
	prepared: Awaited<ReturnType<typeof prepareMcpAgentRun>>,
	usage: LanguageModelUsage
): Promise<void> {
	await trackAgentUsageAndBill({
		usage,
		modelId: prepared.modelId,
		source: prepared.source,
		organizationId: prepared.organizationId,
		userId: prepared.mcpUserId,
		chatId: prepared.sessionId,
		billingCustomerId: prepared.billingCustomerId,
	});
}

function collectToolTrace(
	steps: readonly {
		readonly toolCalls: readonly {
			readonly input: unknown;
			readonly toolCallId: string;
			readonly toolName: string;
		}[];
		readonly toolResults: readonly {
			readonly output: unknown;
			readonly toolCallId: string;
		}[];
	}[]
): McpAgentToolTrace[] {
	const traces: McpAgentToolTrace[] = [];
	for (const step of steps) {
		const outputs = new Map(
			step.toolResults.map((result) => [result.toolCallId, result.output])
		);
		for (const call of step.toolCalls) {
			traces.push({
				index: traces.length,
				input: call.input,
				name: call.toolName,
				output: outputs.get(call.toolCallId) ?? null,
			});
		}
	}
	return traces;
}

function storePreparedConversation(
	prepared: Awaited<ReturnType<typeof prepareMcpAgentRun>>,
	question: string,
	answer: string
): void {
	storeConversation(
		[
			{ role: "user", content: question },
			{ role: "assistant", content: answer },
		],
		prepared.memoryUserId,
		prepared.apiKeyId,
		{
			...(prepared.websiteDomain ? { domain: prepared.websiteDomain } : {}),
			metadata: { source: prepared.source },
			conversationId: prepared.sessionId,
			websiteId: prepared.websiteId,
		}
	);
}

function getTimeoutMs(options: RunMcpAgentOptions): number {
	return options.timeoutMs ?? DEFAULT_MCP_AGENT_TIMEOUT_MS;
}
