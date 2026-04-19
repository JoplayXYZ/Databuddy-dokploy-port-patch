import { stepCountIs } from "ai";
import type { AppContext } from "../config/context";
import {
	type AgentModelKey,
	ANTHROPIC_CACHE_1H,
	models,
} from "../config/models";
import {
	buildAnalyticsInstructions,
	buildFastInstructions,
} from "../prompts/analytics";
import { createAnnotationTools } from "../tools/annotations";
import { executeSqlQueryTool } from "../tools/execute-sql-query";
import { createFunnelTools } from "../tools/funnels";
import { getDataTool } from "../tools/get-data";
import { createGoalTools } from "../tools/goals";
import { createLinksTools } from "../tools/links";
import { createMemoryTools } from "../tools/memory";
import { createProfileTools } from "../tools/profiles";
import { webSearchTool } from "../tools/web-search";
import type { AgentConfig, AgentContext, AgentThinking } from "./types";

const analyticsTools = {
	get_data: getDataTool,
	execute_sql_query: executeSqlQueryTool,
	web_search: webSearchTool,
	...createMemoryTools(),
	...createProfileTools(),
	...createFunnelTools(),
	...createGoalTools(),
	...createAnnotationTools(),
	...createLinksTools(),
};

export const maxSteps = 20;

const THINKING_BUDGET: Record<Exclude<AgentThinking, "off">, number> = {
	low: 2048,
	medium: 8192,
	high: 16_384,
};

function thinkingProviderOptions(
	thinking: AgentThinking | undefined
): AgentConfig["providerOptions"] {
	if (!thinking || thinking === "off") {
		return;
	}
	return {
		anthropic: {
			thinking: { type: "enabled", budgetTokens: THINKING_BUDGET[thinking] },
		},
	};
}

export function createConfig(
	context: AgentContext,
	modelKey: AgentModelKey = "analytics"
): AgentConfig {
	const appContext: AppContext = {
		userId: context.userId,
		websiteId: context.websiteId,
		websiteDomain: context.websiteDomain,
		timezone: context.timezone,
		currentDateTime: new Date().toISOString(),
		chatId: context.chatId,
		requestHeaders: context.requestHeaders,
		billingCustomerId: context.billingCustomerId,
	};

	const isFast = modelKey === "fast";

	return {
		model: models[modelKey],
		system: {
			role: "system",
			content: isFast
				? buildFastInstructions(appContext)
				: buildAnalyticsInstructions(appContext),
			providerOptions: ANTHROPIC_CACHE_1H,
		},
		tools: isFast ? {} : analyticsTools,
		stopWhen: stepCountIs(isFast ? 1 : maxSteps),
		temperature: isFast ? 0.3 : 0.1,
		providerOptions: isFast
			? undefined
			: thinkingProviderOptions(context.thinking),
		experimental_context: appContext,
	};
}
