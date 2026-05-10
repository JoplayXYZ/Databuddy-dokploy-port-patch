import { auth } from "@databuddy/auth";
import { and, db, desc, eq, gte, inArray, isNull } from "@databuddy/db";
import {
	analyticsInsights,
	annotations,
	insightUserFeedback,
	websites,
} from "@databuddy/db/schema";
import {
	cacheable,
	getRedisCache,
	invalidateAgentContextSnapshotsForOwner,
	invalidateAgentContextSnapshotsForWebsite,
} from "@databuddy/redis";
import { getRateLimitHeaders, ratelimit } from "@databuddy/redis/rate-limit";
import { generateText, Output, stepCountIs, ToolLoopAgent } from "ai";
import dayjs from "dayjs";
import { Elysia, t } from "elysia";
import { useLogger } from "evlog/elysia";
import type { AppContext } from "@databuddy/ai/config/context";
import { ANTHROPIC_CACHE_1H, models } from "@databuddy/ai/config/models";
import { createInsightsAgentTools } from "@databuddy/ai/tools/insights-agent-tools";
import {
	fetchInsightDedupeKeyToIdMap,
	insightDedupeKey,
} from "@databuddy/ai/insights/dedupe";
import {
	fetchWebPeriodData,
	getWeekOverWeekPeriod,
	hasWebInsightData,
} from "@databuddy/ai/insights/fetch-context";
import { formatLegacyWebDataForPrompt } from "@databuddy/ai/insights/normalize";
import { validateInsights } from "@databuddy/ai/insights/validate";
import type {
	InsightMetricRow,
	WeekOverWeekPeriod,
} from "@databuddy/ai/insights/types";
import type { ParsedInsight } from "@databuddy/ai/schemas/smart-insights-output";
import { insightsOutputSchema } from "@databuddy/ai/schemas/smart-insights-output";
import { storeAnalyticsSummary } from "@databuddy/ai/lib/supermemory";
import { getAILogger } from "../lib/ai-logger";
import { captureError, mergeWideEvent } from "../lib/tracing";

const CACHE_TTL = 900;
const NEGATIVE_CACHE_TTL = Math.floor(CACHE_TTL / 3);
const CACHE_KEY_PREFIX = "ai-insights";
const TIMEOUT_MS = 60_000;
const INSIGHTS_AGENT_MAX_STEPS = 24;
const INSIGHTS_AGENT_TIMEOUT_MS = 120_000;
const MAX_WEBSITES = 5;
const CONCURRENCY = 3;
const GENERATION_COOLDOWN_HOURS = 6;
const RECENT_INSIGHTS_LOOKBACK_DAYS = 14;
const RECENT_INSIGHTS_PROMPT_LIMIT = 12;
const TOP_INSIGHTS_LIMIT = 10;

interface WebsiteInsight extends ParsedInsight {
	id: string;
	link: string;
	websiteDomain: string;
	websiteId: string;
	websiteName: string | null;
}

interface InsightsPayload {
	insights: WebsiteInsight[];
	source: "ai" | "fallback";
}

interface OrgWebsiteRow {
	domain: string;
	id: string;
	name: string | null;
}

function dedupeKeyFor(insight: WebsiteInsight): string {
	return insightDedupeKey({
		...insight,
		changePercent: insight.changePercent ?? null,
	});
}

function buildInsightLink(websiteId: string, insight: ParsedInsight): string {
	const base = `/websites/${websiteId}`;
	if (
		[
			"error_spike",
			"new_errors",
			"persistent_error_hotspot",
			"reliability_improved",
		].includes(insight.type)
	) {
		return `${base}/errors`;
	}
	if (
		["vitals_degraded", "performance", "performance_improved"].includes(
			insight.type
		)
	) {
		return `${base}/vitals`;
	}
	if (["conversion_leak", "funnel_regression"].includes(insight.type)) {
		return `${base}/funnels`;
	}
	if (
		["custom_event_spike", "engagement_change", "quality_shift"].includes(
			insight.type
		)
	) {
		return `${base}/events/stream`;
	}
	if (insight.type === "uptime_issue") {
		return `${base}/anomalies`;
	}
	return base;
}

interface RawInsightShape {
	changePercent: number | null;
	impactSummary: string | null;
	metrics: unknown;
	sentiment: string;
	severity: string;
	sources: unknown;
	type: string;
}

function parseInsightShape(r: RawInsightShape) {
	return {
		severity: r.severity as ParsedInsight["severity"],
		sentiment: r.sentiment as ParsedInsight["sentiment"],
		type: r.type as ParsedInsight["type"],
		sources:
			(r.sources as Array<"web" | "product" | "ops" | "business"> | null) ?? [],
		metrics: (r.metrics as InsightMetricRow[] | null) ?? [],
		changePercent: r.changePercent ?? undefined,
		impactSummary: r.impactSummary ?? undefined,
	};
}

async function userHasOrgAccess(
	userId: string,
	organizationId: string
): Promise<boolean> {
	const memberships = await db.query.member.findMany({
		where: { userId },
		columns: { organizationId: true },
	});
	return memberships.some((m) => m.organizationId === organizationId);
}

function tryCacheSet(
	redis: ReturnType<typeof getRedis>,
	key: string,
	ttl: number,
	payload: unknown
): void {
	if (!redis) {
		return;
	}
	redis.setex(key, ttl, JSON.stringify(payload)).catch((error: unknown) => {
		useLogger().info("Insights cache write failed (best-effort)", {
			insights: { key, error },
		});
	});
}

async function fetchRecentAnnotations(websiteId: string): Promise<string> {
	const since = dayjs().subtract(14, "day").toDate();

	const rows = await db
		.select({
			text: annotations.text,
			xValue: annotations.xValue,
			tags: annotations.tags,
		})
		.from(annotations)
		.where(
			and(
				eq(annotations.websiteId, websiteId),
				gte(annotations.xValue, since),
				isNull(annotations.deletedAt)
			)
		)
		.orderBy(annotations.xValue)
		.limit(20);

	if (rows.length === 0) {
		return "";
	}

	const lines = rows.map((r) => {
		const date = dayjs(r.xValue).format("YYYY-MM-DD");
		const tags = r.tags?.length ? ` [${r.tags.join(", ")}]` : "";
		return `- ${date}: ${r.text}${tags}`;
	});

	return `\n\nUser annotations (known events that may explain changes):\n${lines.join("\n")}`;
}

async function fetchRecentInsightsForPrompt(
	organizationId: string,
	websiteId: string
): Promise<string> {
	const since = dayjs().subtract(RECENT_INSIGHTS_LOOKBACK_DAYS, "day").toDate();

	const rows = await db
		.select({
			title: analyticsInsights.title,
			type: analyticsInsights.type,
			createdAt: analyticsInsights.createdAt,
		})
		.from(analyticsInsights)
		.where(
			and(
				eq(analyticsInsights.organizationId, organizationId),
				eq(analyticsInsights.websiteId, websiteId),
				gte(analyticsInsights.createdAt, since)
			)
		)
		.orderBy(desc(analyticsInsights.createdAt))
		.limit(RECENT_INSIGHTS_PROMPT_LIMIT);

	if (rows.length === 0) {
		return "";
	}

	const lines = rows.map(
		(r) =>
			`- [${r.type}] ${r.title} (${dayjs(r.createdAt).format("YYYY-MM-DD")})`
	);

	return `\n\n## Recently reported insights for this website (avoid repeating the same narrative unless something materially changed)\n${lines.join("\n")}`;
}

function formatOrgWebsitesContext(
	orgSites: OrgWebsiteRow[],
	currentWebsiteId: string
): string {
	if (orgSites.length <= 1) {
		return "";
	}
	const sorted = [...orgSites].sort((a, b) =>
		a.domain.localeCompare(b.domain, "en")
	);
	const lines = sorted.map((s) => {
		const label = s.name?.trim() ? s.name.trim() : s.domain;
		const marker =
			s.id === currentWebsiteId
				? " — **metrics below are for this site only**"
				: "";
		return `- ${label} (${s.domain})${marker}`;
	});
	return `## Organization websites (same account, separate analytics)
Each row is a different tracked property (e.g. marketing site vs app vs docs). The week-over-week metrics in this message apply only to the site marked "metrics below". Do not blend numbers across rows. If referrers include another domain from this list, treat it as cross-property traffic (e.g. landing → product) and name both sides clearly.

${lines.join("\n")}

`;
}

const INSIGHTS_SYSTEM_PROMPT = `<role>
You are an analytics insights engine. Return exactly 3 week-over-week insights when there are 3 distinct data-backed signals; otherwise return only the distinct signals that exist. Rank by actionability and user/business impact.
</role>

<selection_rules>
- Write for a founder/operator, not an analytics engineer. Translate technical metrics into plain outcomes: "interactions got slower", "pages feel slower", "setup is leaking users", "one source now dominates traffic".
- Prefer reliability, conversion/product impact, engagement quality, broken instrumentation, and meaningful behavior changes over vanity traffic spikes.
- Score actionability × impact, not raw percentage magnitude. Reserve priority 8-10 for likely user, revenue, or operational impact.
- Prefer fewer, sharper insights over broad coverage. Return only signals a user can act on this week.
- Avoid repeating recently reported narratives unless the signal materially changed.
</selection_rules>

<data_rules>
- Use only provided data, tool results, annotations, and recent-insight context.
- Do not invent revenue, signups, retention, funnel conversion, causality, root causes, or business impact.
- If multiple org websites are listed, keep properties separate; cross-domain referrers are cross-property traffic, not generic referrals.
- Use cautious language for correlations unless segment-level evidence directly proves the cause.
- Do not punt, apologize, or say you cannot produce insights when any useful metrics exist. If one query is sparse, use stronger available evidence and lower confidence.
</data_rules>

<output_rules>
- Prefer 3 concise insights: reliability/product risk first, then engagement/acquisition opportunity. Do not make near-duplicates.
- Each insight must be one clear signal with 1-5 metrics; primary metric first.
- Metrics array owns the numbers. Description/suggestion should reference metric labels, not restate values.
- Keep title under 80 chars, description under 320 chars, suggestion under 260 chars.
- Titles must be plain English and user-facing. Do not put raw metric jargon like INP, LCP, FCP, TTFB, CLS, or p75 in titles; put technical metric names only in the metrics array.
- Keep description 1-2 concise sentences: what changed, why it matters, and whether cause is evidence or hypothesis.
- Suggestion must be a specific next action with an operational verb such as inspect, review, compare, segment, drill into, fix, audit, trace, or verify. Never use generic monitoring advice.
- Suggestion must name the exact product surface to inspect next: funnel step, goal, referrer segment, page path, error class, session stream, web vital, flag rollout, or agent diagnostic prompt.
- subjectKey must be stable; sources must include only evidence domains used; confidence 0-1 should reflect evidence strength.
- impactSummary is optional, one sentence under 220 characters.
</output_rules>

<quality_examples>
Good: Error Rate rose while Sessions stayed stable -> reliability issue; suggest reviewing affected page/errors first.
Good: INP p75 rose -> title "Interactions got slower"; metrics can still include "INP p75".
Good: Onboarding step 2 drop-off is 80% -> title "Onboarding is leaking at step 2".
Bad: Pricing Visitors rose -> "revenue opportunity" without business data.
Bad: Twitter rose and Bounce Rate worsened -> "Twitter caused the drop" without segmented engagement data.
Bad: "INP p75 still rising" as a title; users should not need to know web-vitals acronyms.
</quality_examples>

<self_check>
Before finalizing: exactly 3 if data supports it, data-backed only, metrics present, primary metric first, no duplicate narrative, concise copy, specific action, named product surface, no punt on partial data.
</self_check>`;

async function validateOrRepairInsights(
	insights: ParsedInsight[],
	context: { domain: string; mode: "agent" | "legacy"; websiteId: string }
): Promise<ParsedInsight[]> {
	const validated = validateInsights(insights);
	if (validated.warnings.length > 0) {
		useLogger().warn("Insights validation repaired or dropped output", {
			insights: {
				websiteId: context.websiteId,
				mode: context.mode,
				warnings: validated.warnings,
			},
		});
	}

	const targetCount = Math.min(3, insights.length);
	if (targetCount === 0 || validated.insights.length >= targetCount) {
		return validated.insights;
	}

	try {
		const ai = getAILogger();
		const repair = await generateText({
			model: ai.wrap(models.balanced),
			output: Output.object({ schema: insightsOutputSchema }),
			messages: [
				{
					role: "system",
					content: `Repair Databuddy insight cards. Return exactly ${targetCount} concise, valid cards when the source contains ${targetCount} distinct data-backed signals. Use only the provided metrics and claims; do not invent numbers, causes, revenue impact, or new entities. Keep title <=80 chars, description <=320 chars, suggestion <=260 chars. Write for a founder/operator: titles must be plain English and avoid raw metric jargon like INP, LCP, FCP, TTFB, CLS, or p75. Technical metric names may remain in the metrics array. Suggestions need specific operational actions, not monitoring. Soften unsupported causality.`,
				},
				{
					role: "user",
					content: JSON.stringify(
						{
							domain: context.domain,
							validationWarnings: validated.warnings,
							originalInsights: insights,
						},
						null,
						2
					),
				},
			],
			temperature: 0,
			maxOutputTokens: 4096,
			abortSignal: AbortSignal.timeout(30_000),
			experimental_telemetry: {
				isEnabled: true,
				functionId: "databuddy.insights.repair",
				metadata: {
					source: "insights",
					feature: "smart_insights",
					mode: context.mode,
					websiteId: context.websiteId,
					websiteDomain: context.domain,
				},
			},
		});

		const repairedOutput = repair.output?.insights ?? [];
		const repaired = validateInsights(repairedOutput);
		if (repaired.warnings.length > 0) {
			useLogger().warn("Insights repair validation warnings", {
				insights: {
					websiteId: context.websiteId,
					mode: context.mode,
					warnings: repaired.warnings,
				},
			});
		}

		if (repaired.insights.length >= validated.insights.length) {
			return repaired.insights.slice(0, targetCount);
		}
	} catch (error) {
		useLogger().warn("Insights repair failed", {
			insights: { websiteId: context.websiteId, mode: context.mode, error },
		});
	}

	return validated.insights;
}

async function analyzeWebsiteLegacy(
	organizationId: string,
	userId: string,
	websiteId: string,
	domain: string,
	timezone: string,
	period: WeekOverWeekPeriod,
	orgSites: OrgWebsiteRow[],
	annotationContext: string,
	recentInsightsBlock: string
): Promise<ParsedInsight[]> {
	const currentRange = period.current;
	const previousRange = period.previous;

	const [current, previous] = await Promise.all([
		fetchWebPeriodData(
			websiteId,
			domain,
			currentRange.from,
			currentRange.to,
			timezone
		),
		fetchWebPeriodData(
			websiteId,
			domain,
			previousRange.from,
			previousRange.to,
			timezone
		),
	]);

	const hasData = current.summary.length > 0 || current.topPages.length > 0;
	if (!hasData) {
		return [];
	}

	const dataSection = formatLegacyWebDataForPrompt(
		current,
		previous,
		currentRange,
		previousRange
	);

	const orgContext = formatOrgWebsitesContext(orgSites, websiteId);
	const prompt = `Analyze this website's week-over-week data and return insights.\n\n${orgContext}${dataSection}${annotationContext}${recentInsightsBlock}`;

	try {
		const ai = getAILogger();
		const result = await generateText({
			model: ai.wrap(models.balanced),
			output: Output.object({ schema: insightsOutputSchema }),
			messages: [
				{
					role: "system",
					content: INSIGHTS_SYSTEM_PROMPT,
					providerOptions: ANTHROPIC_CACHE_1H,
				},
				{ role: "user", content: prompt },
			],
			temperature: 0.2,
			maxOutputTokens: 8192,
			abortSignal: AbortSignal.timeout(TIMEOUT_MS),
			experimental_telemetry: {
				isEnabled: true,
				functionId: "databuddy.insights.analyze_website",
				metadata: {
					source: "insights",
					feature: "smart_insights",
					mode: "legacy_fallback",
					organizationId,
					userId,
					websiteId,
					websiteDomain: domain,
					timezone,
				},
			},
		});

		if (!result.output) {
			useLogger().warn("No structured output from insights model (legacy)", {
				insights: { websiteId },
			});
			return [];
		}

		return await validateOrRepairInsights(result.output.insights, {
			domain,
			mode: "legacy",
			websiteId,
		});
	} catch (error) {
		useLogger().warn("Failed to generate insights (legacy)", {
			insights: { websiteId, error },
		});
		return [];
	}
}

async function analyzeWebsite(
	organizationId: string,
	userId: string,
	websiteId: string,
	domain: string,
	timezone: string,
	period: WeekOverWeekPeriod,
	orgSites: OrgWebsiteRow[],
	requestHeaders: Headers
): Promise<ParsedInsight[]> {
	const currentRange = period.current;
	const previousRange = period.previous;

	const hasData = await hasWebInsightData(
		websiteId,
		domain,
		currentRange.from,
		currentRange.to,
		timezone
	);
	if (!hasData) {
		return [];
	}

	const [annotationContext, recentInsightsBlock] = await Promise.all([
		fetchRecentAnnotations(websiteId),
		fetchRecentInsightsForPrompt(organizationId, websiteId),
	]);

	const orgContext = formatOrgWebsitesContext(orgSites, websiteId);
	const userPrompt = `Analyze this website's week-over-week data and produce insights.

**Current period:** ${currentRange.from} to ${currentRange.to}
**Previous period:** ${previousRange.from} to ${previousRange.to}
**Timezone:** ${timezone}
**Domain:** ${domain}

Use web_metrics to pull metrics for both current and previous periods before inferring trends. Start with summary_metrics for both periods, then add top_pages, error_summary, top_referrers, country, browser_name, vitals_overview, or custom_events queries only when they sharpen the narrative. Use product_metrics for goals, funnels, retention, and custom event behavior when a traffic change may have downstream product impact. Use ops_context for page-level errors, uptime, anomaly signals, and recent flag rollouts when reliability or product changes may explain the trend. Use business_context for revenue totals, attribution, and product mix when commercial impact matters.

${orgContext}${annotationContext}${recentInsightsBlock}`;

	const { tools } = createInsightsAgentTools({
		websiteId,
		domain,
		timezone,
		periodBounds: { current: currentRange, previous: previousRange },
	});

	try {
		const appContext: AppContext = {
			userId,
			organizationId,
			websiteId,
			websiteDomain: domain,
			timezone,
			currentDateTime: new Date().toISOString(),
			chatId: `insights:${organizationId}:${websiteId}`,
			requestHeaders,
		};

		const ai = getAILogger();
		const agent = new ToolLoopAgent({
			model: ai.wrap(models.balanced),
			instructions: {
				role: "system",
				content: INSIGHTS_SYSTEM_PROMPT,
				providerOptions: ANTHROPIC_CACHE_1H,
			},
			output: Output.object({ schema: insightsOutputSchema }),
			tools,
			stopWhen: stepCountIs(INSIGHTS_AGENT_MAX_STEPS),
			prepareStep: ({ stepNumber }) => {
				if (stepNumber === 0) {
					return {
						activeTools: ["web_metrics"],
						toolChoice: { type: "tool", toolName: "web_metrics" },
					};
				}
				return {};
			},
			onStepFinish: ({ usage, finishReason, toolCalls }) => {
				const toolNames = toolCalls.map((toolCall) => toolCall.toolName);
				mergeWideEvent({
					insights_agent_step_tool_calls: toolCalls.length,
					insights_agent_step_total_tokens: usage?.totalTokens ?? 0,
					insights_agent_step_used_tools: toolNames.length > 0,
				});
				useLogger().info("Insights agent step finished", {
					insights: {
						websiteId,
						finishReason,
						toolCalls: toolNames,
						totalTokens: usage?.totalTokens,
					},
				});
			},
			temperature: 0.2,
			experimental_context: appContext,
			experimental_telemetry: {
				isEnabled: true,
				functionId: "databuddy.insights.analyze_website",
				metadata: {
					source: "insights",
					feature: "smart_insights",
					mode: "agent",
					organizationId,
					userId,
					websiteId,
					websiteDomain: domain,
					timezone,
				},
			},
		});

		const result = await agent.generate({
			messages: [{ role: "user", content: userPrompt }],
			abortSignal: AbortSignal.timeout(INSIGHTS_AGENT_TIMEOUT_MS),
		});

		if (result.output?.insights?.length) {
			return await validateOrRepairInsights(result.output.insights, {
				domain,
				mode: "agent",
				websiteId,
			});
		}

		useLogger().warn("Insights agent finished without structured output", {
			insights: { websiteId },
		});
	} catch (error) {
		useLogger().warn("Insights agent failed, using legacy fallback", {
			insights: { websiteId, error },
		});
	}

	return analyzeWebsiteLegacy(
		organizationId,
		userId,
		websiteId,
		domain,
		timezone,
		period,
		orgSites,
		annotationContext,
		recentInsightsBlock
	);
}

async function processInBatches<T, R>(
	items: T[],
	action: (item: T) => Promise<R>,
	limit: number
): Promise<R[]> {
	const results: R[] = [];
	let nextIndex = 0;

	async function worker() {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= items.length) {
				break;
			}
			const item = items[index];
			if (item === undefined) {
				break;
			}
			results.push(await action(item));
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => worker())
	);
	return results;
}

async function getRecentInsightsFromDb(
	organizationId: string
): Promise<WebsiteInsight[] | null> {
	const cutoff = dayjs().subtract(GENERATION_COOLDOWN_HOURS, "hour").toDate();

	const rows = await db
		.select({
			id: analyticsInsights.id,
			websiteId: analyticsInsights.websiteId,
			websiteName: websites.name,
			websiteDomain: websites.domain,
			title: analyticsInsights.title,
			description: analyticsInsights.description,
			suggestion: analyticsInsights.suggestion,
			severity: analyticsInsights.severity,
			sentiment: analyticsInsights.sentiment,
			type: analyticsInsights.type,
			priority: analyticsInsights.priority,
			changePercent: analyticsInsights.changePercent,
			subjectKey: analyticsInsights.subjectKey,
			sources: analyticsInsights.sources,
			confidence: analyticsInsights.confidence,
			impactSummary: analyticsInsights.impactSummary,
			metrics: analyticsInsights.metrics,
			createdAt: analyticsInsights.createdAt,
		})
		.from(analyticsInsights)
		.innerJoin(websites, eq(analyticsInsights.websiteId, websites.id))
		.where(
			and(
				eq(analyticsInsights.organizationId, organizationId),
				gte(analyticsInsights.createdAt, cutoff),
				isNull(websites.deletedAt)
			)
		)
		.orderBy(desc(analyticsInsights.priority))
		.limit(10);

	if (rows.length === 0) {
		return null;
	}

	return rows.map(
		(r): WebsiteInsight => ({
			id: r.id,
			websiteId: r.websiteId,
			websiteName: r.websiteName,
			websiteDomain: r.websiteDomain,
			link: `/websites/${r.websiteId}`,
			title: r.title,
			description: r.description,
			suggestion: r.suggestion,
			priority: r.priority,
			subjectKey: r.subjectKey,
			confidence: r.confidence,
			...parseInsightShape(r),
		})
	);
}

function getRedis() {
	try {
		return getRedisCache();
	} catch {
		return null;
	}
}

async function invalidateInsightsCacheForOrg(
	organizationId: string
): Promise<void> {
	const redis = getRedis();
	if (!redis) {
		return;
	}
	const pattern = `${CACHE_KEY_PREFIX}:${organizationId}:*`;
	let cursor = "0";
	try {
		do {
			const [nextCursor, keys] = (await redis.scan(
				cursor,
				"MATCH",
				pattern,
				"COUNT",
				100
			)) as [string, string[]];
			cursor = nextCursor;
			if (keys.length > 0) {
				await redis.del(...keys);
			}
		} while (cursor !== "0");
	} catch (error) {
		useLogger().info("Insights cache invalidation scan failed (best-effort)", {
			insights: { organizationId, error },
		});
	}
}

const NARRATIVE_RATE_LIMIT = 30;
const NARRATIVE_RATE_WINDOW_SECS = 3600;
const NARRATIVE_CACHE_TTL_SECS = 3600;
const NARRATIVE_INSIGHTS_LIMIT = 5;

const RANGE_WORDS: Record<string, string> = {
	"7d": "week",
	"30d": "month",
	"90d": "quarter",
};

function rangeWord(range: "7d" | "30d" | "90d"): string {
	return RANGE_WORDS[range] ?? "quarter";
}

function buildDeterministicNarrative(
	range: "7d" | "30d" | "90d",
	topInsights: {
		title: string;
		severity: string;
		websiteName: string | null;
	}[]
): string {
	const word = rangeWord(range);
	const headline = topInsights[0];
	if (!headline) {
		return `All systems healthy this ${word}. No actionable signals detected.`;
	}
	const siteSuffix = headline.websiteName ? ` on ${headline.websiteName}` : "";
	if (topInsights.length === 1) {
		return `This ${word}: ${headline.title}${siteSuffix}.`;
	}
	const extra = topInsights.length - 1;
	return `This ${word}: ${headline.title}${siteSuffix}, plus ${extra} more signal${extra === 1 ? "" : "s"} worth reviewing.`;
}

const RANGE_TO_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

const generateNarrativeCached = cacheable(
	async function generateNarrativeCached(
		organizationId: string,
		range: "7d" | "30d" | "90d"
	): Promise<{ narrative: string }> {
		const cutoff = dayjs().subtract(RANGE_TO_DAYS[range], "day").toDate();

		const topInsights = await db
			.select({
				title: analyticsInsights.title,
				description: analyticsInsights.description,
				severity: analyticsInsights.severity,
				changePercent: analyticsInsights.changePercent,
				websiteName: websites.name,
			})
			.from(analyticsInsights)
			.innerJoin(websites, eq(analyticsInsights.websiteId, websites.id))
			.where(
				and(
					eq(analyticsInsights.organizationId, organizationId),
					gte(analyticsInsights.createdAt, cutoff),
					isNull(websites.deletedAt)
				)
			)
			.orderBy(desc(analyticsInsights.priority))
			.limit(NARRATIVE_INSIGHTS_LIMIT);

		if (topInsights.length === 0) {
			return {
				narrative: `All systems healthy this ${rangeWord(range)}. No actionable signals detected.`,
			};
		}

		const insightLines = topInsights.map((ins) => {
			const site = ins.websiteName ? ` [${ins.websiteName}]` : "";
			const change =
				ins.changePercent == null
					? ""
					: ` (${ins.changePercent > 0 ? "+" : ""}${ins.changePercent.toFixed(0)}%)`;
			return `- [${ins.severity}] ${ins.title}${change}${site}: ${ins.description ?? ""}`;
		});

		const prompt = `You are an analytics assistant summarizing an organization's state over the last ${range}.

Write a crisp 2–3 sentence executive summary of the top insights below.

Rules:
- Lead with the most important change
- Include concrete numbers when available
- Never exceed 60 words total
- State facts, do not editorialize
- If nothing meaningful is happening, say so plainly

Top signals this ${range}:
${insightLines.join("\n")}`;

		let narrative = "";
		try {
			const result = await generateText({
				model: getAILogger().wrap(models.balanced),
				prompt,
				temperature: 0.2,
				maxOutputTokens: 200,
			});
			narrative = result.text.trim();
		} catch (error) {
			useLogger().warn("Narrative LLM call failed", {
				insights: { organizationId, range, error },
			});
		}

		if (!narrative) {
			narrative = buildDeterministicNarrative(range, topInsights);
			mergeWideEvent({ insights_narrative_fallback: true });
		}

		return { narrative };
	},
	{
		expireInSec: NARRATIVE_CACHE_TTL_SECS,
		prefix: "insights-narrative",
	}
);

export const insights = new Elysia({ prefix: "/v1/insights" })
	.derive(async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return { user: session?.user ?? null, requestHeaders: request.headers };
	})
	.onBeforeHandle(({ user, set }) => {
		if (!user) {
			mergeWideEvent({ insights_ai_auth: "unauthorized" });
			set.status = 401;
			return {
				success: false,
				error: "Authentication required",
				code: "AUTH_REQUIRED",
			};
		}
	})
	.get(
		"/history",
		async ({ query, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				return { success: false, error: "User ID required", insights: [] };
			}

			const { organizationId, websiteId: websiteIdFilter } = query;
			const limitParsed = Number.parseInt(query.limit ?? "50", 10);
			const limit = Number.isFinite(limitParsed)
				? Math.min(Math.max(limitParsed, 1), 100)
				: 50;
			const offsetParsed = Number.parseInt(query.offset ?? "0", 10);
			const offset = Number.isFinite(offsetParsed)
				? Math.max(offsetParsed, 0)
				: 0;

			mergeWideEvent({ insights_history_org_id: organizationId });

			if (!(await userHasOrgAccess(userId, organizationId))) {
				mergeWideEvent({ insights_history_access: "denied" });
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					insights: [],
				};
			}

			const whereClause = websiteIdFilter
				? and(
						eq(analyticsInsights.organizationId, organizationId),
						eq(analyticsInsights.websiteId, websiteIdFilter),
						isNull(websites.deletedAt)
					)
				: and(
						eq(analyticsInsights.organizationId, organizationId),
						isNull(websites.deletedAt)
					);

			const rows = await db
				.select({
					id: analyticsInsights.id,
					runId: analyticsInsights.runId,
					websiteId: analyticsInsights.websiteId,
					websiteName: websites.name,
					websiteDomain: websites.domain,
					title: analyticsInsights.title,
					description: analyticsInsights.description,
					suggestion: analyticsInsights.suggestion,
					severity: analyticsInsights.severity,
					sentiment: analyticsInsights.sentiment,
					type: analyticsInsights.type,
					priority: analyticsInsights.priority,
					changePercent: analyticsInsights.changePercent,
					subjectKey: analyticsInsights.subjectKey,
					sources: analyticsInsights.sources,
					confidence: analyticsInsights.confidence,
					impactSummary: analyticsInsights.impactSummary,
					metrics: analyticsInsights.metrics,
					createdAt: analyticsInsights.createdAt,
					currentPeriodFrom: analyticsInsights.currentPeriodFrom,
					currentPeriodTo: analyticsInsights.currentPeriodTo,
					previousPeriodFrom: analyticsInsights.previousPeriodFrom,
					previousPeriodTo: analyticsInsights.previousPeriodTo,
					timezone: analyticsInsights.timezone,
				})
				.from(analyticsInsights)
				.innerJoin(websites, eq(analyticsInsights.websiteId, websites.id))
				.where(whereClause)
				.orderBy(desc(analyticsInsights.createdAt))
				.limit(limit)
				.offset(offset);

			const insights = rows.map((r) => ({
				id: r.id,
				runId: r.runId,
				websiteId: r.websiteId,
				websiteName: r.websiteName,
				websiteDomain: r.websiteDomain,
				link: `/websites/${r.websiteId}`,
				title: r.title,
				description: r.description,
				suggestion: r.suggestion,
				priority: r.priority,
				subjectKey: r.subjectKey,
				confidence: r.confidence,
				...parseInsightShape(r),
				createdAt: r.createdAt.toISOString(),
				currentPeriodFrom: r.currentPeriodFrom,
				currentPeriodTo: r.currentPeriodTo,
				previousPeriodFrom: r.previousPeriodFrom,
				previousPeriodTo: r.previousPeriodTo,
				timezone: r.timezone,
			}));

			return {
				success: true,
				insights,
				hasMore: rows.length === limit,
			};
		},
		{
			query: t.Object({
				organizationId: t.String(),
				limit: t.Optional(t.String()),
				offset: t.Optional(t.String()),
				websiteId: t.Optional(t.String()),
			}),
		}
	)
	.get(
		"/org-narrative",
		async ({ query, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				return { success: false, error: "User ID required" };
			}

			const { organizationId, range } = query;
			mergeWideEvent({
				insights_narrative_org_id: organizationId,
				insights_narrative_range: range,
			});

			if (!(await userHasOrgAccess(userId, organizationId))) {
				mergeWideEvent({ insights_narrative_access: "denied" });
				set.status = 403;
				return { success: false, error: "Access denied to this organization" };
			}

			const rl = await ratelimit(
				`insights:narrative:${organizationId}:${userId}`,
				NARRATIVE_RATE_LIMIT,
				NARRATIVE_RATE_WINDOW_SECS
			);
			const rlHeaders = getRateLimitHeaders(rl);
			for (const [key, value] of Object.entries(rlHeaders)) {
				set.headers[key] = value;
			}
			if (!rl.success) {
				set.status = 429;
				return {
					success: false,
					error: "Rate limit exceeded. Try again later.",
				};
			}

			try {
				const { narrative } = await generateNarrativeCached(
					organizationId,
					range
				);
				return {
					success: true,
					narrative,
					generatedAt: new Date().toISOString(),
				};
			} catch (error) {
				captureError(error, {
					insights_narrative_org_id: organizationId,
					insights_narrative_range: range,
				});
				useLogger().warn("Failed to generate org narrative", {
					insights: { organizationId, range, error },
				});
				set.status = 500;
				return { success: false, error: "Could not generate narrative" };
			}
		},
		{
			query: t.Object({
				organizationId: t.String(),
				range: t.Union([t.Literal("7d"), t.Literal("30d"), t.Literal("90d")]),
			}),
		}
	)
	.post(
		"/clear",
		async ({ body, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				return { success: false, error: "User ID required", deleted: 0 };
			}

			const { organizationId } = body;
			mergeWideEvent({ insights_clear_org_id: organizationId });

			if (!(await userHasOrgAccess(userId, organizationId))) {
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					deleted: 0,
				};
			}

			const idRows = await db
				.select({ id: analyticsInsights.id })
				.from(analyticsInsights)
				.where(eq(analyticsInsights.organizationId, organizationId));

			const ids = idRows.map((r) => r.id);

			if (ids.length > 0) {
				await db
					.delete(insightUserFeedback)
					.where(
						and(
							eq(insightUserFeedback.organizationId, organizationId),
							inArray(insightUserFeedback.insightId, ids)
						)
					);
				await db
					.delete(analyticsInsights)
					.where(eq(analyticsInsights.organizationId, organizationId));
			}

			await invalidateInsightsCacheForOrg(organizationId);
			await invalidateAgentContextSnapshotsForOwner(organizationId);
			mergeWideEvent({ insights_cleared: ids.length });

			return { success: true, deleted: ids.length };
		},
		{
			body: t.Object({
				organizationId: t.String(),
			}),
		}
	)
	.post(
		"/ai",
		async ({ body, user, set, requestHeaders }) => {
			const userId = user?.id;
			if (!userId) {
				mergeWideEvent({ insights_ai_error: "missing_user_id" });
				return { success: false, error: "User ID required", insights: [] };
			}

			const { organizationId, timezone = "UTC" } = body;
			mergeWideEvent({
				insights_org_id: organizationId,
				insights_timezone: timezone,
			});

			const redis = getRedis();
			const cacheKey = `${CACHE_KEY_PREFIX}:${organizationId}:${timezone}`;

			if (redis) {
				try {
					const cached = await redis.get(cacheKey);
					if (cached) {
						mergeWideEvent({ insights_cache: "hit" });
						const payload = JSON.parse(cached) as InsightsPayload;
						return { success: true, ...payload };
					}
				} catch (error) {
					useLogger().info(
						"Insights cache read failed; continuing without cache",
						{
							insights: { error },
						}
					);
				}
			}

			mergeWideEvent({ insights_cache: "miss" });

			if (!(await userHasOrgAccess(userId, organizationId))) {
				mergeWideEvent({ insights_access: "denied" });
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					insights: [],
				};
			}

			const recentInsights = await getRecentInsightsFromDb(organizationId);
			if (recentInsights) {
				mergeWideEvent({
					insights_returned: recentInsights.length,
					insights_source: "db_cooldown",
				});
				const payload: InsightsPayload = {
					insights: recentInsights,
					source: "ai",
				};
				tryCacheSet(redis, cacheKey, CACHE_TTL, payload);
				return { success: true, ...payload };
			}

			const orgSites = await db.query.websites.findMany({
				where: { organizationId, deletedAt: { isNull: true } },
				columns: { id: true, name: true, domain: true },
			});

			if (orgSites.length === 0) {
				mergeWideEvent({ insights_websites: 0 });
				return { success: true, insights: [], source: "ai" };
			}

			try {
				const period = getWeekOverWeekPeriod();
				const dedupeKeyToId =
					await fetchInsightDedupeKeyToIdMap(organizationId);
				const groups = await processInBatches(
					orgSites.slice(0, MAX_WEBSITES),
					async (site: { id: string; name: string | null; domain: string }) => {
						const results = await analyzeWebsite(
							organizationId,
							userId,
							site.id,
							site.domain,
							timezone,
							period,
							orgSites,
							requestHeaders
						);
						return results.map(
							(insight): WebsiteInsight => ({
								...insight,
								id: crypto.randomUUID(),
								websiteId: site.id,
								websiteName: site.name,
								websiteDomain: site.domain,
								link: buildInsightLink(site.id, insight),
							})
						);
					},
					CONCURRENCY
				);

				const merged = groups.flat().sort((a, b) => b.priority - a.priority);
				const seenInBatch = new Set<string>();
				const sorted: WebsiteInsight[] = [];
				for (const insight of merged) {
					const key = dedupeKeyFor(insight);
					if (seenInBatch.has(key)) {
						continue;
					}
					seenInBatch.add(key);
					const existingId = dedupeKeyToId.get(key);
					sorted.push(existingId ? { ...insight, id: existingId } : insight);
					if (sorted.length >= TOP_INSIGHTS_LIMIT) {
						break;
					}
				}

				const runId = crypto.randomUUID();
				let finalInsights: WebsiteInsight[] = sorted;
				if (sorted.length > 0) {
					const toInsert = sorted
						.filter((insight) => {
							const existingId = dedupeKeyToId.get(dedupeKeyFor(insight));
							return !(existingId && insight.id === existingId);
						})
						.map((insight) => ({
							id: insight.id,
							organizationId,
							websiteId: insight.websiteId,
							runId,
							title: insight.title,
							description: insight.description,
							suggestion: insight.suggestion,
							severity: insight.severity,
							sentiment: insight.sentiment,
							type: insight.type,
							priority: insight.priority,
							changePercent: insight.changePercent ?? null,
							subjectKey: insight.subjectKey,
							sources: insight.sources,
							confidence: insight.confidence,
							impactSummary: insight.impactSummary ?? null,
							metrics: insight.metrics.length > 0 ? insight.metrics : null,
							timezone,
							currentPeriodFrom: period.current.from,
							currentPeriodTo: period.current.to,
							previousPeriodFrom: period.previous.from,
							previousPeriodTo: period.previous.to,
						}));

					const updatePayload = {
						runId,
						timezone,
						currentPeriodFrom: period.current.from,
						currentPeriodTo: period.current.to,
						previousPeriodFrom: period.previous.from,
						previousPeriodTo: period.previous.to,
						createdAt: new Date(),
					};

					try {
						if (toInsert.length > 0) {
							await db.insert(analyticsInsights).values(toInsert);
						}
						const toRefresh = sorted.filter((insight) => {
							const existingId = dedupeKeyToId.get(dedupeKeyFor(insight));
							return existingId !== undefined && insight.id === existingId;
						});
						await Promise.all(
							toRefresh.map((insight) =>
								db
									.update(analyticsInsights)
									.set({
										...updatePayload,
										title: insight.title,
										description: insight.description,
										suggestion: insight.suggestion,
										severity: insight.severity,
										sentiment: insight.sentiment,
										type: insight.type,
										priority: insight.priority,
										changePercent: insight.changePercent ?? null,
										subjectKey: insight.subjectKey,
										sources: insight.sources,
										confidence: insight.confidence,
										impactSummary: insight.impactSummary ?? null,
										metrics:
											insight.metrics.length > 0 ? insight.metrics : null,
									})
									.where(eq(analyticsInsights.id, insight.id))
							)
						);
					} catch (error) {
						useLogger().warn("Failed to persist analytics insights", {
							insights: { organizationId, error },
						});
						finalInsights = [];
						mergeWideEvent({ insights_persist_failed: true });
					}

					await Promise.all(
						[...new Set(finalInsights.map((insight) => insight.websiteId))].map(
							(websiteId) =>
								invalidateAgentContextSnapshotsForWebsite(websiteId)
						)
					);
				}

				for (const site of orgSites.slice(0, MAX_WEBSITES)) {
					const siteInsights = finalInsights.filter(
						(s) => s.websiteId === site.id
					);
					if (siteInsights.length > 0) {
						const summary = siteInsights
							.map(
								(s) =>
									`[${s.severity}] ${s.title}: ${s.description} Suggestion: ${s.suggestion}`
							)
							.join("\n");
						storeAnalyticsSummary(
							`Weekly insights for ${site.domain} (${dayjs().format("YYYY-MM-DD")}):\n${summary}`,
							site.id,
							{ period: "weekly" }
						).catch((error: unknown) => {
							useLogger().warn("Failed to store analytics summary", {
								insights: { websiteId: site.id, error },
							});
						});
					}
				}

				const payload: InsightsPayload = {
					insights: finalInsights,
					source: "ai",
				};

				tryCacheSet(
					redis,
					cacheKey,
					finalInsights.length > 0 ? CACHE_TTL : NEGATIVE_CACHE_TTL,
					payload
				);

				mergeWideEvent({
					insights_returned: finalInsights.length,
					insights_source: "ai",
				});
				return { success: true, ...payload };
			} catch (error) {
				mergeWideEvent({ insights_error: true });
				useLogger().error(
					error instanceof Error ? error : new Error(String(error)),
					{ insights: { organizationId } }
				);
				return { success: false, insights: [], source: "fallback" };
			}
		},
		{
			body: t.Object({
				organizationId: t.String(),
				timezone: t.Optional(t.String()),
			}),
			idleTimeout: 240_000,
		}
	);
