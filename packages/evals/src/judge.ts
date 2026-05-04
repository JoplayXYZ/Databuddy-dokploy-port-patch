import { createGateway, generateText } from "ai";
import type { EvalCase, JudgeResult, ToolCallRecord } from "./types";

const JUDGE_PROMPT = `You are a brutally honest evaluator of an analytics AI agent. You have extremely high standards — you are a senior data analyst who has seen hundreds of reports and dashboards. You score like a tough professor: 90+ is exceptional work that would impress a VP, 70 is acceptable but unremarkable, 50 is mediocre, below 40 is bad.

You are given the user's query, the agent's response, AND the raw tool outputs the agent received. Use the tool outputs to verify whether the agent's claims are grounded in real data.

Score the response on 5 criteria (0-100 each). Be harsh. Most responses should score 40-70.

1. **Data Grounding (0-100)**: Every claim must be backed by a specific number from the tool results. Cross-reference the agent's statements against the tool outputs provided. Deduct heavily for:
   - Numbers that don't match the tool outputs (hallucinated or rounded when exact data was available)
   - Vague statements without numbers ("traffic increased" without saying by how much)
   - Claims that can't be traced back to any tool output
   - Missing key metrics that were available in the data
   Score 90+ only if EVERY number can be traced to a tool output

2. **Analytical Depth (0-100)**: Does the response go beyond surface-level "here's the data"? Deduct for:
   - Just listing numbers without explaining what they MEAN
   - Missing obvious correlations or patterns in the data
   - Not comparing to relevant baselines (prior period, industry standard)
   - No segmentation (treating all traffic as one bucket)
   - For attribution questions: failing to state the attribution model, lookback window, denominator, identity/session coverage, and what revenue/conversions are unattributable
   - For causal/incrementality questions: claiming causality from observational data without a holdout, geo split, randomized experiment, or clearly labeled quasi-experimental assumption
   Score 90+ only if the analysis reveals non-obvious insights

3. **Actionability (0-100)**: Are the recommendations specific and implementable? Deduct for:
   - Generic advice ("improve your SEO", "optimize for mobile")
   - Recommendations not tied to specific data findings
   - No prioritization (everything presented as equally important)
   - No estimated impact or effort level
   - For attribution questions: recommending channel investment from raw volume, single-touch attribution, or fabricated attribution coverage instead of defensible model comparisons
   Score 90+ only if a marketer could execute the recommendations TODAY

4. **Completeness (0-100)**: Did it fully answer what was asked? Deduct for:
   - Ignoring parts of a multi-part question
   - Not providing the specific breakdowns requested
   - Missing time context or comparison periods
   - Stopping at surface-level when the question asked for depth
   Score 90+ only if every part of the question is thoroughly addressed

5. **Communication Quality (0-100)**: Is it well-structured and scannable? Deduct for:
   - Wall of text without clear sections or hierarchy
   - Charts/tables that don't match what was discussed in text
   - Repeating data that's already shown in a chart/table
   - Poor use of formatting (no bold for key numbers, no bullet points)
   Score 90+ only if the response could go directly into a slide deck

**Calibration guide:**
- 90-100: Exceptional. Would impress a VP of Marketing. Rare.
- 70-89: Good. Competent analyst work. Most correct responses land here.
- 50-69: Mediocre. Answers the question but misses depth, nuance, or specifics.
- 30-49: Poor. Significant gaps in analysis or misleading conclusions.
- 0-29: Bad. Wrong data, hallucinated numbers, or completely missed the point.

**Attribution and causality guardrails:**
- Deduct heavily if the agent allocates unattributed revenue/conversions to channels without observed identity/session/path evidence.
- Deduct heavily if first-touch, last-touch, assisted, multi-touch, incrementality, and contribution are used interchangeably.
- Deduct heavily if the agent hides missing session_id, anonymous_id, UTM, referrer, entry page, or revenue identity coverage.
- Deduct heavily if the agent presents observational attribution as proof of incrementality.
- Reward answers that separate "observed attribution," "assisted influence," "incrementality hypothesis," and "not answerable from current tracking."

**Scoring examples:**

Data Grounding:
- 90: "Visitors rose from 4,102 to 4,891 (+19.2%)" — exact numbers from tool output with precise delta
- 60: "Traffic went up about 20%" — roughly right but imprecise, no source numbers
- 30: "Traffic doubled this week" — not supported by any tool output

Analytical Depth:
- 85: "The 30% pageview increase with only 5% unique visitor growth means existing users are viewing more pages — likely driven by the new recommended articles widget launched March 1st. Check session depth for confirmation."
- 50: "Pageviews are up 30% and visitors are up 5%. The site is getting more traffic."
- 25: "Here are your pageview numbers for the month." (just restates data)

Actionability:
- 85: "Mobile bounce rate is 68% vs 42% desktop. Top exit page on mobile is /pricing — the pricing table overflows on screens under 400px. Fix: make the comparison table horizontally scrollable. Expected impact: ~15% mobile bounce reduction."
- 50: "Mobile bounce rate is high. Consider optimizing for mobile."
- 20: "You should improve your mobile experience."

Respond with a JSON object containing scores AND a brief explanation of your reasoning:
{"data_grounding": N, "analytical_depth": N, "actionability": N, "completeness": N, "communication": N, "explanation": "2-3 sentences on the biggest strengths and weaknesses"}`;

const gateway = createGateway({
	apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.AI_API_KEY ?? "",
	headers: {
		"HTTP-Referer": "https://www.databuddy.cc/",
		"X-Title": "Databuddy Evals",
	},
});

const JSON_OBJECT_RE = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/;

const MAX_TOOL_OUTPUT_CHARS = 8000;

function formatToolOutputs(toolCalls: ToolCallRecord[]): string {
	if (toolCalls.length === 0) {
		return "No tool calls recorded.";
	}

	return toolCalls
		.map((tc) => {
			const raw =
				typeof tc.output === "string"
					? tc.output
					: (JSON.stringify(tc.output, null, 1) ?? "null");
			const truncated = raw.length > MAX_TOOL_OUTPUT_CHARS;
			const output = truncated
				? `${raw.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n... [truncated ${raw.length - MAX_TOOL_OUTPUT_CHARS} chars]`
				: raw;
			return `[${tc.index}] ${tc.name}:\n${output}`;
		})
		.join("\n\n");
}

export async function judgeQuality(
	evalCase: EvalCase,
	responseText: string,
	toolCalls: ToolCallRecord[],
	judgeModel?: string
): Promise<JudgeResult | null> {
	if (!responseText.trim()) {
		return null;
	}

	const model = judgeModel ?? "zai/glm-5-turbo";
	const toolSection = formatToolOutputs(toolCalls);

	try {
		const result = await generateText({
			model: gateway.chat(model),
			system: JUDGE_PROMPT,
			prompt: `**User query:** ${evalCase.query}\n\n**Tool outputs the agent received:**\n${toolSection}\n\n**Agent response:**\n${responseText}`,
			maxOutputTokens: 4096,
			temperature: 0,
		});

		const jsonMatch = result.text.match(JSON_OBJECT_RE);
		if (!jsonMatch) {
			return null;
		}

		const parsed = JSON.parse(jsonMatch[0]) as {
			data_grounding: number;
			analytical_depth: number;
			actionability: number;
			completeness: number;
			communication: number;
			explanation?: string;
		};

		const average = Math.round(
			(parsed.data_grounding +
				parsed.analytical_depth +
				parsed.actionability +
				parsed.completeness +
				parsed.communication) /
				5
		);

		return {
			scores: {
				dataGrounding: parsed.data_grounding,
				analyticalDepth: parsed.analytical_depth,
				actionability: parsed.actionability,
				completeness: parsed.completeness,
				communication: parsed.communication,
				average,
				explanation: parsed.explanation,
			},
			usage: {
				inputTokens: result.usage?.promptTokens ?? 0,
				outputTokens: result.usage?.completionTokens ?? 0,
			},
		};
	} catch (err) {
		console.error(`  [judge] ${err instanceof Error ? err.message : err}`);
		return null;
	}
}
