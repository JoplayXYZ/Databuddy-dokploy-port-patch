import { usdToAgentCredits } from "@databuddy/shared/agent-credits";
import type { LanguageModelUsage } from "ai";
import type { SourceModel } from "tokenlens";
import { computeTokenCostsForModel } from "tokenlens/helpers";
import { vercelModels } from "tokenlens/providers/vercel";

type VercelModelId = keyof typeof vercelModels.models;

interface ModelCost {
	cache_read: number;
	cache_write: number;
	input: number;
	output: number;
}

interface CostModel {
	fallback: boolean;
	id: string;
	model: SourceModel;
}

const MODEL_COST_ALIASES: Record<string, string> = {
	"anthropic/claude-sonnet-4": "anthropic/claude-4-sonnet",
	"anthropic/claude-sonnet-4.6": "anthropic/claude-4-sonnet",
};

const MODEL_COST_OVERRIDES: Record<string, ModelCost> = {
	"anthropic/claude-4-sonnet": {
		input: 3,
		output: 15,
		cache_read: 0.3,
		cache_write: 6,
	},
	"deepseek/deepseek-v4-flash": {
		input: 0.14,
		output: 0.28,
		cache_read: 0,
		cache_write: 0,
	},
};

const FALLBACK_MODEL_ID = "anthropic/claude-4-sonnet";

const toSourceModel = (id: string, cost: ModelCost): SourceModel =>
	({ canonical_id: id, cost, id }) as unknown as SourceModel;

const lookupModel = (modelId: string): SourceModel | undefined => {
	const override = MODEL_COST_OVERRIDES[modelId];
	if (override) {
		return toSourceModel(modelId, override);
	}

	const model = vercelModels.models[modelId as VercelModelId];
	return model?.cost
		? ({ canonical_id: model.id, ...model } as unknown as SourceModel)
		: undefined;
};

function resolveCostModel(modelId: string): CostModel {
	const model = lookupModel(modelId);
	if (model) {
		return { fallback: false, id: modelId, model };
	}

	const aliasId = MODEL_COST_ALIASES[modelId];
	const alias = aliasId ? lookupModel(aliasId) : undefined;
	if (alias && aliasId) {
		return { fallback: false, id: aliasId, model: alias };
	}

	const fallback = lookupModel(FALLBACK_MODEL_ID);
	if (fallback) {
		return { fallback: true, id: FALLBACK_MODEL_ID, model: fallback };
	}

	return {
		fallback: true,
		id: modelId,
		model: toSourceModel(modelId, {
			input: 0,
			output: 0,
			cache_read: 0,
			cache_write: 0,
		}),
	};
}

const toCostUsage = (usage: LanguageModelUsage, freshInputTokens: number) => ({
	input_tokens: freshInputTokens,
	output_tokens: usage.outputTokens,
	cache_read_tokens: usage.inputTokenDetails?.cacheReadTokens,
	cache_write_tokens: usage.inputTokenDetails?.cacheWriteTokens,
	reasoning_tokens: usage.outputTokenDetails?.reasoningTokens,
});

/**
 * Best-effort token telemetry for the agent route.
 *
 * - Always returns raw token counts from the AI SDK usage object.
 * - Looks up USD cost in the Vercel AI Gateway catalog, with explicit aliases
 *   for gateway ids that the catalog has not caught up with yet. Only truly
 *   unknown model ids are marked as fallback-priced.
 */

export interface UsageTelemetry {
	agent_credits_used: number;
	cache_read_tokens: number;
	cache_write_tokens: number;
	cost_cache_read_usd: number;
	cost_cache_write_usd: number;
	cost_fallback: boolean;
	cost_input_usd: number;
	cost_model_id: string;
	cost_output_usd: number;
	cost_reasoning_usd: number;
	cost_total_usd: number;
	/** Fresh, non-cached input tokens — what to bill at the input rate. */
	fresh_input_tokens: number;
	/** Total input tokens reported by the provider (cache + non-cache). */
	input_tokens: number;
	output_tokens: number;
	reasoning_tokens: number;
	total_tokens: number;
	[k: string]: string | number | boolean;
}

const num = (value: number | undefined): number =>
	typeof value === "number" && Number.isFinite(value) ? value : 0;

export function summarizeAgentUsage(
	modelId: string,
	usage: LanguageModelUsage
): UsageTelemetry {
	const inputTokens = num(usage.inputTokens);
	const outputTokens = num(usage.outputTokens);
	const cacheReadTokens = num(usage.inputTokenDetails?.cacheReadTokens);
	const cacheWriteTokens = num(usage.inputTokenDetails?.cacheWriteTokens);
	// Prefer the provider-reported fresh count; fall back to subtraction if
	// the provider doesn't expose it explicitly.
	const freshInputTokens =
		num(usage.inputTokenDetails?.noCacheTokens) ||
		Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);

	const normalizedUsage = toCostUsage(usage, freshInputTokens);
	const costModel = resolveCostModel(modelId);
	const costs = computeTokenCostsForModel({
		model: costModel.model,
		usage: normalizedUsage,
	});
	const costTotalUsd = num(costs?.totalTokenCostUSD);

	return {
		input_tokens: inputTokens,
		fresh_input_tokens: freshInputTokens,
		output_tokens: outputTokens,
		total_tokens: inputTokens + outputTokens,
		cache_read_tokens: cacheReadTokens,
		cache_write_tokens: cacheWriteTokens,
		reasoning_tokens: num(usage.outputTokenDetails?.reasoningTokens),
		cost_input_usd: num(costs?.inputTokenCostUSD),
		cost_output_usd: num(costs?.outputTokenCostUSD),
		cost_total_usd: costTotalUsd,
		cost_cache_read_usd: num(costs?.cacheReadTokenCostUSD),
		cost_cache_write_usd: num(costs?.cacheWriteTokenCostUSD),
		cost_reasoning_usd: num(costs?.reasoningTokenCostUSD),
		cost_model_id: costModel.id,
		cost_fallback: costModel.fallback,
		agent_credits_used: usdToAgentCredits(costTotalUsd),
	};
}
