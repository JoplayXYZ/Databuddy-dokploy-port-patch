import { describe, expect, test } from "bun:test";
import {
	MIN_AGENT_CREDIT_CHECK_BALANCE,
	usdPerMillionTokensToAgentCreditsPerToken,
	usdToAgentCredits,
} from "./agent-credits";

describe("agent credit math", () => {
	test("converts USD into credits with the configured markup", () => {
		expect(usdToAgentCredits(0.1)).toBe(2);
	});

	test("converts model per-million-token prices into per-token credits", () => {
		expect(usdPerMillionTokensToAgentCreditsPerToken(3)).toBe(0.000_06);
		expect(usdPerMillionTokensToAgentCreditsPerToken(15)).toBe(0.000_3);
	});

	test("keeps a small preflight threshold for fractional-credit requests", () => {
		expect(MIN_AGENT_CREDIT_CHECK_BALANCE).toBeGreaterThan(0);
		expect(MIN_AGENT_CREDIT_CHECK_BALANCE).toBeLessThan(1);
	});
});
