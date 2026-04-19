import { createGateway } from "ai";

const apiKey = (
	process.env.AI_GATEWAY_API_KEY ??
	process.env.AI_API_KEY ??
	""
).trim();

export const isAiGatewayConfigured = apiKey.length > 0;

const gateway = createGateway({
	apiKey,
	headers: {
		"HTTP-Referer": "https://www.databuddy.cc/",
		"X-Title": "Databuddy",
	},
});

export const modelNames = {
	tiny: "openai/gpt-oss-120b",
	fast: "anthropic/claude-haiku-4.5",
	analytics: "anthropic/claude-sonnet-4.6",
	perplexity: "perplexity/sonar-pro",
} as const;

export type AgentModelKey = "fast" | "analytics";

export const models = {
	tiny: gateway.chat(modelNames.tiny),
	fast: gateway.chat(modelNames.fast),
	analytics: gateway.chat(modelNames.analytics),
	perplexity: gateway.chat(modelNames.perplexity),
} as const;

export const ANTHROPIC_CACHE_1H = {
	anthropic: {
		cacheControl: { type: "ephemeral", ttl: "1h" },
	},
} as const;

export const AI_MODEL_MAX_RETRIES = 3;
