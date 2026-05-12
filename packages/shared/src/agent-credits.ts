export const AGENT_CREDITS_PER_USD = 10;
export const AGENT_CREDIT_MARKUP = 2;
export const MIN_AGENT_CREDIT_CHECK_BALANCE = 0.01;

function clean(value: number): number {
	return Number.isFinite(value) && value > 0
		? Number.parseFloat(value.toPrecision(12))
		: 0;
}

export function usdToAgentCredits(usd: number): number {
	return clean(usd * AGENT_CREDIT_MARKUP * AGENT_CREDITS_PER_USD);
}

export function usdPerMillionTokensToAgentCreditsPerToken(
	usdPerMillion: number
): number {
	return usdToAgentCredits(usdPerMillion / 1_000_000);
}
