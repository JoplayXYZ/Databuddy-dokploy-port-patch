/**
 * Single source of truth for agent credit rates.
 *
 * Derives per-token credit costs from tokenlens' Vercel AI Gateway catalog
 * plus a business markup, so the Autumn creditSchema in autumn.config.ts
 * matches the model we actually run.
 *
 * Credit formula: credits_per_token = usd_per_token × markup × credits_per_usd
 */

import {
	AGENT_CREDIT_MARKUP,
	AGENT_CREDITS_PER_USD,
	usdPerMillionTokensToAgentCreditsPerToken,
} from "@databuddy/shared/agent-credits";
import { vercelModels } from "tokenlens/providers/vercel";

export const CREDITS_PER_USD = AGENT_CREDITS_PER_USD;
export const MARKUP = AGENT_CREDIT_MARKUP;

/**
 * Pricing proxy for production dashboard agent traffic. Vercel Gateway serves
 * `anthropic/claude-sonnet-4.6`, while tokenlens currently exposes the same
 * Sonnet pricing under `anthropic/claude-4-sonnet`.
 */
export const BASELINE_MODEL_ID = "anthropic/claude-4-sonnet" as const;

/**
 * Anthropic's 1-hour prompt cache write rate (USD per 1M tokens).
 *
 * The Vercel AI Gateway catalog in tokenlens exposes Anthropic's
 * 5-minute cache rate ($3.75/M), but our agent is configured with
 * `ttl: "1h"` in packages/ai/src/ai/config/models.ts so Anthropic
 * bills the 1-hour rate ($6/M). We override cacheWrite here to match
 * production billing. If the agent switches back to 5-minute TTL,
 * delete this constant and let tokenlens drive the rate directly.
 */
const CACHE_WRITE_1H_USD_PER_M_TOKENS = 6;

interface ModelCostsPerMillion {
	cache_read: number;
	cache_write: number;
	input: number;
	output: number;
}

function getBaselineUsdPerMillion(): ModelCostsPerMillion {
	const model = vercelModels.models[BASELINE_MODEL_ID];
	if (!model?.cost) {
		throw new Error(
			`tokenlens vercelModels is missing cost for ${BASELINE_MODEL_ID}`
		);
	}
	return {
		input: model.cost.input,
		output: model.cost.output,
		cache_read: model.cost.cache_read,
		// Override with the 1-hour rate — see CACHE_WRITE_1H_USD_PER_M_TOKENS.
		cache_write: CACHE_WRITE_1H_USD_PER_M_TOKENS,
	};
}

export interface AgentCreditSchema {
	/** Credits per cache-read input token. */
	cacheRead: number;
	/** Credits per cache-write input token. */
	cacheWrite: number;
	/** Credits per fresh (non-cached) input token. */
	input: number;
	/** Credits per output token. */
	output: number;
}

const baselineUsd = getBaselineUsdPerMillion();

/**
 * Canonical agent credit schema. Import this from autumn.config.ts and
 * from any cost probe so both stay in lockstep.
 */
export const AGENT_CREDIT_SCHEMA: AgentCreditSchema = {
	input: usdPerMillionTokensToAgentCreditsPerToken(baselineUsd.input),
	output: usdPerMillionTokensToAgentCreditsPerToken(baselineUsd.output),
	cacheRead: usdPerMillionTokensToAgentCreditsPerToken(baselineUsd.cache_read),
	cacheWrite: usdPerMillionTokensToAgentCreditsPerToken(
		baselineUsd.cache_write
	),
};
