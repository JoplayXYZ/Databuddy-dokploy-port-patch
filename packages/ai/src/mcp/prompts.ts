import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type PromptRegistration = Parameters<McpServer["registerPrompt"]>;

interface PromptDef {
	args?: Record<string, z.ZodTypeAny>;
	body: (args: Record<string, string | undefined>) => string;
	description: string;
	name: string;
	title: string;
}

const websiteArg = z
	.string()
	.optional()
	.describe(
		"Website to scope the workflow to. Accepts websiteId, websiteName, or websiteDomain. Optional when only one website is accessible."
	);

const periodArg = z
	.enum(["last_7d", "last_14d", "last_30d", "last_90d"])
	.optional()
	.describe("Date range preset. Defaults to last_7d.");

function whichWebsite(website: string | undefined): string {
	return website
		? `Scope: website = ${website}.`
		: "Scope: confirm websiteName/Domain/Id with list_websites first if more than one is accessible.";
}

function whichPeriod(period: string | undefined): string {
	return `Date range: preset = ${period ?? "last_7d"}.`;
}

const DATABUDDY_PROMPTS: PromptDef[] = [
	{
		name: "weekly_report",
		title: "Weekly analytics report",
		description:
			"Produce a structured weekly digest: traffic trends, top pages, top referrers, error health, and one item worth investigating.",
		args: { website: websiteArg, period: periodArg },
		body: (args) => `Build a weekly analytics digest.

${whichWebsite(args.website)}
${whichPeriod(args.period)}

Batch one get_data call covering:
- summary_metrics (sessions, visitors, pageviews, bounce_rate)
- top_pages (limit 5)
- top_referrers (limit 5)
- error_summary

Then summarize in this order:
1. Headline metric movement vs prior period (use compare_metric if direction is unclear).
2. Top 3 traffic drivers (pages or referrers) with sessions and trend arrow.
3. Error health: total errors, top 1 error type, affected sessions.
4. One actionable item worth investigating this week — pick the largest unexplained delta.

Format the digest as short bullets. Skip empty sections. Never fabricate metrics that didn't return data.`,
	},
	{
		name: "triage_errors",
		title: "Triage recent errors",
		description:
			"Walk through error_summary → error_types → errors_by_page → recent_errors for the top group, then prioritize by user impact.",
		args: { website: websiteArg, period: periodArg },
		body: (args) => `Triage recent JavaScript errors.

${whichWebsite(args.website)}
${whichPeriod(args.period)}

Steps:
1. get_data error_summary — capture total errors, error rate, affected users.
2. get_data error_types (limit 10) — identify top groups by count.
3. get_data errors_by_page (limit 10) — identify hot pages.
4. For the top 1-2 error types, get_data recent_errors with limit=5 and filter on message contains the type signature. Stack traces are truncated at 1500 chars — don't ask for limit > 20.

Output a prioritized list, sorted by affected_users × error_count:
- Error type or message excerpt
- Affected users / total occurrences
- Pages with the most occurrences
- Likely root cause guess (1 line) and next investigation step

Skip the noise: AbortError, ResizeObserver loop limit, browser-extension stacks. Flag them but don't lead with them.`,
	},
	{
		name: "funnel_health",
		title: "Audit funnel conversion health",
		description:
			"List funnels, run per-step analytics, surface the largest drop-offs and any funnel that recently degraded.",
		args: { website: websiteArg, period: periodArg },
		body: (args) => `Audit funnel health.

${whichWebsite(args.website)}
${whichPeriod(args.period)}

Steps:
1. list_funnels — enumerate active funnels (skip archived).
2. For each funnel, get_funnel_analytics. Capture overall conversion rate and the per-step drop-off.
3. compare_metric on overall conversion if the user asked about a change vs prior period.

Output table, one row per funnel:
- Funnel name
- Overall conversion
- Worst step (biggest absolute drop) — name + drop %
- Status: healthy (>X), watch, leaking — define X relative to the funnel's own historical baseline if available, otherwise <2% absolute conversion is "leaking".

End with 1-3 concrete next steps (which step to investigate, which user segment to drill into).`,
	},
	{
		name: "flag_rollout_check",
		title: "Review feature flag rollout state",
		description:
			"List feature flags and flag stale, over-targeted, or risky rollouts that need a decision.",
		args: { website: websiteArg },
		body: (args) => `Review feature flag rollout state.

${whichWebsite(args.website)}

Steps:
1. list_flags — capture every active flag and its config.
2. For each active flag, note: type (boolean/rollout/multivariant), status, rolloutPercentage, number of rules, last update time.

Surface, in order:
- Stale flags: status=active and not updated in >30 days, especially rollouts at 100%. Candidates for cleanup.
- Risky rollouts: rolloutPercentage between 1-99 for >14 days without movement. Either ramp or roll back.
- Overlapping rules: same flag with >5 rules — review for redundancy.
- Missing description or unclear name.

For each finding, recommend one action: cleanup, ramp, roll back, or document. Don't propose mutations without explicit user confirmation.`,
	},
];

export function registerDatabuddyPrompts(server: McpServer): void {
	for (const prompt of DATABUDDY_PROMPTS) {
		// The SDK's zod-compat type targets a different Zod surface than this repo's Zod v4.
		const config = {
			title: prompt.title,
			description: prompt.description,
			argsSchema: prompt.args,
		} as unknown as PromptRegistration[1];

		const callback = ((args: Record<string, string | undefined>) => ({
			messages: [
				{
					role: "user" as const,
					content: {
						type: "text" as const,
						text: prompt.body(args),
					},
				},
			],
		})) as unknown as PromptRegistration[2];

		server.registerPrompt(prompt.name, config, callback);
	}
}
