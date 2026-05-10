import type { EvalCase } from "../types";

const WS = "OXmNQsViBT-FOS_wZCTHc";

/**
 * Smart-insights cases — benchmarks for Databuddy's actionable insight style:
 * grounded cards, directionally correct severity/sentiment, cautious causality,
 * and concrete next actions instead of generic analytics commentary.
 */
export const insightsCases: EvalCase[] = [
	{
		id: "insights-direction-and-sentiment-consistency",
		category: "insights",
		name: "Keeps metric direction, sentiment, and wording consistent",
		query:
			"Generate 3 actionable Databuddy insight cards for this week. Be careful: if errors, bounce, drop-off, or latency go down, that is good even though the numeric change is negative. Do not say a metric rose if it fell. Include the metric evidence and one concrete next action per card.",
		websiteId: WS,
		tags: ["insights", "direction", "sentiment"],
		expect: {
			maxSteps: 20,
			maxLatencyMs: 300_000,
			minQualityScore: 75,
			responseNotMatches: [
				{
					description: "does not equate every negative change with bad news",
					pattern:
						"error(s)? (fell|dropped|declined).{0,120}(bad|worse|warning|problem)",
				},
			],
		},
	},
	{
		id: "insights-cautious-causality",
		category: "insights",
		name: "Uses cautious causal language unless segment data proves the cause",
		query:
			"Create actionable insights from the weekly analytics. If a referrer mix changed at the same time as engagement changed, do not claim the new referrer caused engagement to drop unless you have segment-level engagement data. Phrase hypotheses clearly and say what to verify next.",
		websiteId: WS,
		tags: ["insights", "grounding", "causality"],
		expect: {
			maxSteps: 20,
			maxLatencyMs: 300_000,
			minQualityScore: 78,
			responseMatches: [
				{
					description: "includes a verification step for inferred causes",
					pattern:
						"\\b(verify|check|compare|segment|break down|validate|confirm|filter|drill into|look at|split by)\\b",
				},
			],
			responseNotMatches: [
				{
					description: "does not overstate causality from correlation",
					pattern:
						"\\b(proves|caused by|because of)\\b.{0,80}\\b(referrer|Toolfolio|Twitter|source)\\b",
				},
			],
		},
	},
	{
		id: "insights-actionable-deep-link-intent",
		category: "insights",
		name: "Turns each insight into a product action, not a memo",
		query:
			"Produce Databuddy actionable insights for the current week. Keep each one short: what changed, why it matters, and the exact next product action. Prefer actions like inspect affected sessions, open the funnel step, compare referrers, review errors for a page, or ask the agent to diagnose. Avoid generic monitoring advice.",
		websiteId: WS,
		tags: ["insights", "actionability", "brevity"],
		expect: {
			maxSteps: 20,
			maxLatencyMs: 300_000,
			maxResponseWords: 650,
			minQualityScore: 80,
			responseMatches: [
				{
					description: "contains specific operational next actions",
					pattern:
						"\\b(inspect|open|compare|review|diagnose|audit|profile|fix|investigate|filter|trace|segment|drill into)\\b",
				},
			],
			responseNotMatches: [
				{
					description: "avoids generic monitoring advice",
					pattern: "\\b(monitor|keep an eye|watch this|track closely)\\b",
				},
			],
		},
	},
];
