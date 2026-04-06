import { cacheable } from "@databuddy/redis";
import dayjs from "dayjs";
import { z } from "zod";
import {
	fetchInsightsForOrgs,
	type InsightRow,
} from "../../lib/insights-query";
import { executeQuery } from "../../query";
import {
	defineMcpTool,
	McpToolError,
	type McpToolFactory,
} from "./define-tool";
import { resolveOrganizationIds } from "./tool-context";

// ---------------------------------------------------------------------------
// Constants & registries
// ---------------------------------------------------------------------------

const INSIGHT_TYPES = [
	"error_spike",
	"new_errors",
	"vitals_degraded",
	"custom_event_spike",
	"traffic_drop",
	"traffic_spike",
	"bounce_rate_change",
	"engagement_change",
	"referrer_change",
	"page_trend",
	"positive_trend",
	"performance",
	"uptime_issue",
] as const;

const INSIGHT_SEVERITIES = ["critical", "warning", "info"] as const;
const INSIGHT_SENTIMENTS = ["positive", "neutral", "negative"] as const;

const PERIOD_PRESETS = [
	"last_24h",
	"last_7d",
	"last_14d",
	"last_30d",
	"last_90d",
	"today",
	"yesterday",
] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const SINCE_PRESETS = ["last_24h", "last_7d", "last_30d", "last_90d"] as const;

const INSIGHTS_LIST_CACHE_TTL = 60;
const INSIGHTS_LIST_FETCH_LIMIT = 200;

type MetricFormat = "number" | "percent" | "duration_s";
type BetterWhen = "higher" | "lower";

interface MetricDefinition {
	betterWhen: BetterWhen;
	field: string;
	format: MetricFormat;
	label: string;
	queryType: string;
}

const METRIC_REGISTRY: Record<string, MetricDefinition> = {
	visitors: {
		label: "Visitors",
		queryType: "summary_metrics",
		field: "unique_visitors",
		format: "number",
		betterWhen: "higher",
	},
	sessions: {
		label: "Sessions",
		queryType: "summary_metrics",
		field: "sessions",
		format: "number",
		betterWhen: "higher",
	},
	pageviews: {
		label: "Pageviews",
		queryType: "summary_metrics",
		field: "pageviews",
		format: "number",
		betterWhen: "higher",
	},
	bounce_rate: {
		label: "Bounce Rate",
		queryType: "summary_metrics",
		field: "bounce_rate",
		format: "percent",
		betterWhen: "lower",
	},
	session_duration: {
		label: "Median Session Duration",
		queryType: "summary_metrics",
		field: "median_session_duration",
		format: "duration_s",
		betterWhen: "higher",
	},
	events: {
		label: "Total Events",
		queryType: "summary_metrics",
		field: "total_events",
		format: "number",
		betterWhen: "higher",
	},
};

const METRIC_KEYS = Object.keys(METRIC_REGISTRY) as [string, ...string[]];

interface DimensionDefinition {
	keyField: string;
	label: string;
	queryType: string;
}

const DIMENSION_REGISTRY: Record<string, DimensionDefinition> = {
	pages: { label: "Page", queryType: "top_pages", keyField: "name" },
	referrers: {
		label: "Referrer",
		queryType: "top_referrers",
		keyField: "name",
	},
	countries: { label: "Country", queryType: "country", keyField: "name" },
	browsers: { label: "Browser", queryType: "browser_name", keyField: "name" },
	os: { label: "Operating System", queryType: "os_name", keyField: "name" },
};

const DIMENSION_KEYS = Object.keys(DIMENSION_REGISTRY) as [string, ...string[]];

const ANOMALY_METRICS: { key: string; label: string; field: string }[] = [
	{ key: "visitors", label: "Visitors", field: "visitors" },
	{ key: "sessions", label: "Sessions", field: "sessions" },
	{ key: "pageviews", label: "Pageviews", field: "pageviews" },
	{ key: "bounce_rate", label: "Bounce Rate", field: "bounce_rate" },
	{
		key: "session_duration",
		label: "Median Session Duration",
		field: "median_session_duration",
	},
];

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
	return ISO_DATE_RE.test(value) && dayjs(value).isValid();
}

function resolvePeriodRange(input: {
	period?: PeriodPreset;
	from?: string;
	to?: string;
}): { from: string; to: string } | Error {
	if (input.from || input.to) {
		if (!(input.from && input.to)) {
			return new Error("Both 'from' and 'to' are required for custom periods");
		}
		if (!isValidDate(input.from)) {
			return new Error("'from' must be YYYY-MM-DD");
		}
		if (!isValidDate(input.to)) {
			return new Error("'to' must be YYYY-MM-DD");
		}
		if (dayjs(input.from).isAfter(dayjs(input.to))) {
			return new Error("'from' must be on or before 'to'");
		}
		return { from: input.from, to: input.to };
	}
	const today = dayjs();
	const preset: PeriodPreset = input.period ?? "last_7d";
	switch (preset) {
		case "last_24h":
			return {
				from: today.subtract(1, "day").format("YYYY-MM-DD"),
				to: today.format("YYYY-MM-DD"),
			};
		case "last_7d":
			return {
				from: today.subtract(6, "day").format("YYYY-MM-DD"),
				to: today.format("YYYY-MM-DD"),
			};
		case "last_14d":
			return {
				from: today.subtract(13, "day").format("YYYY-MM-DD"),
				to: today.format("YYYY-MM-DD"),
			};
		case "last_30d":
			return {
				from: today.subtract(29, "day").format("YYYY-MM-DD"),
				to: today.format("YYYY-MM-DD"),
			};
		case "last_90d":
			return {
				from: today.subtract(89, "day").format("YYYY-MM-DD"),
				to: today.format("YYYY-MM-DD"),
			};
		case "today": {
			const t = today.format("YYYY-MM-DD");
			return { from: t, to: t };
		}
		case "yesterday": {
			const y = today.subtract(1, "day").format("YYYY-MM-DD");
			return { from: y, to: y };
		}
		default:
			return new Error(`Unknown period preset: ${preset}`);
	}
}

function computePreviousPeriod(current: { from: string; to: string }): {
	from: string;
	to: string;
} {
	const start = dayjs(current.from);
	const end = dayjs(current.to);
	const days = end.diff(start, "day") + 1;
	return {
		from: start.subtract(days, "day").format("YYYY-MM-DD"),
		to: start.subtract(1, "day").format("YYYY-MM-DD"),
	};
}

function parseSinceShorthand(since: string): Date | undefined {
	const now = dayjs();
	switch (since) {
		case "last_24h":
			return now.subtract(24, "hour").toDate();
		case "last_7d":
			return now.subtract(7, "day").toDate();
		case "last_30d":
			return now.subtract(30, "day").toDate();
		case "last_90d":
			return now.subtract(90, "day").toDate();
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatMetricValue(value: number, format: MetricFormat): string {
	if (format === "percent") {
		return `${value.toFixed(1)}%`;
	}
	if (format === "duration_s") {
		if (value < 60) {
			return `${Math.round(value)}s`;
		}
		const minutes = Math.floor(value / 60);
		const seconds = Math.round(value % 60);
		return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
	}
	if (Math.abs(value) >= 1000) {
		return Math.round(value).toLocaleString("en-US");
	}
	if (Number.isInteger(value)) {
		return value.toString();
	}
	return value.toFixed(1);
}

function safeDeltaPercent(current: number, previous: number): number {
	if (previous === 0) {
		return current === 0 ? 0 : 100;
	}
	return ((current - previous) / previous) * 100;
}

function deltaDirection(
	current: number,
	previous: number
): "up" | "down" | "flat" {
	if (current > previous) {
		return "up";
	}
	if (current < previous) {
		return "down";
	}
	return "flat";
}

function buildMetricHeadline(
	label: string,
	current: number,
	previous: number,
	format: MetricFormat
): string {
	const direction = deltaDirection(current, previous);
	const currentStr = formatMetricValue(current, format);
	if (direction === "flat") {
		return `${label} unchanged at ${currentStr}`;
	}
	const previousStr = formatMetricValue(previous, format);
	const pctStr = Math.abs(safeDeltaPercent(current, previous)).toFixed(1);
	const word = direction === "up" ? "up" : "down";
	return `${label} ${word} ${pctStr}% (${currentStr} vs ${previousStr})`;
}

function buildDimensionHeadline(
	dimensionLabel: string,
	keyName: string,
	metricLabel: string,
	current: number,
	previous: number
): string {
	const direction = deltaDirection(current, previous);
	if (direction === "flat") {
		return `${dimensionLabel} "${keyName}" ${metricLabel.toLowerCase()} unchanged at ${current}`;
	}
	if (previous === 0) {
		return `${dimensionLabel} "${keyName}" is new — ${current} ${metricLabel.toLowerCase()}`;
	}
	if (current === 0) {
		return `${dimensionLabel} "${keyName}" dropped to 0 (was ${previous} ${metricLabel.toLowerCase()})`;
	}
	const pctStr = Math.abs(safeDeltaPercent(current, previous)).toFixed(1);
	const word = direction === "up" ? "up" : "down";
	return `${dimensionLabel} "${keyName}" ${metricLabel.toLowerCase()} ${word} ${pctStr}% (${current} vs ${previous})`;
}

function buildAnomalyHeadline(
	label: string,
	current: number,
	baseline: number,
	zScore: number,
	format: MetricFormat
): string {
	const direction = current > baseline ? "up" : "down";
	const pctStr = Math.abs(safeDeltaPercent(current, baseline)).toFixed(1);
	const currentStr = formatMetricValue(current, format);
	const baselineStr = formatMetricValue(baseline, format);
	return `${label} ${direction} ${pctStr}% vs baseline ${baselineStr} (now ${currentStr}, z=${zScore.toFixed(1)})`;
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	let sum = 0;
	for (const v of values) {
		sum += v;
	}
	return sum / values.length;
}

function stddev(values: number[]): number {
	if (values.length < 2) {
		return 0;
	}
	const m = mean(values);
	let variance = 0;
	for (const v of values) {
		variance += (v - m) ** 2;
	}
	variance /= values.length - 1;
	return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Insight row → MCP shape
// ---------------------------------------------------------------------------

function mapInsightRow(row: InsightRow) {
	return {
		id: row.id,
		type: row.type,
		severity: row.severity,
		sentiment: row.sentiment,
		priority: row.priority,
		title: row.title,
		description: row.description,
		suggestion: row.suggestion,
		changePercent: row.changePercent ?? undefined,
		metrics: row.metrics ?? [],
		currentPeriod: {
			from: row.currentPeriodFrom,
			to: row.currentPeriodTo,
		},
		previousPeriod: {
			from: row.previousPeriodFrom,
			to: row.previousPeriodTo,
		},
		websiteId: row.websiteId,
		websiteName: row.websiteName,
		websiteDomain: row.websiteDomain,
		link: `/websites/${row.websiteId}`,
		createdAt: row.createdAt.toISOString(),
		timezone: row.timezone,
	};
}

// ---------------------------------------------------------------------------
// Cached fetch
// ---------------------------------------------------------------------------

const cachedFetchInsightsForOrgs = cacheable(fetchInsightsForOrgs, {
	expireInSec: INSIGHTS_LIST_CACHE_TTL,
	prefix: "mcp:insights",
});

// ---------------------------------------------------------------------------
// list_insights
// ---------------------------------------------------------------------------

const listInsightsTool = defineMcpTool(
	{
		name: "list_insights",
		description:
			"List recent AI-generated insights (anomalies, trends, top movers). Defaults to org-wide. Pass a websiteId/Name/Domain to scope. Use when the user asks 'what changed' or 'what's interesting'.",
		inputSchema: z.object({
			websiteId: z.string().optional().describe("Optional. Scope to one site."),
			websiteName: z.string().optional(),
			websiteDomain: z.string().optional(),
			type: z
				.array(z.enum(INSIGHT_TYPES))
				.optional()
				.describe(
					"Filter by insight type(s) (e.g. ['traffic_drop','error_spike'])"
				),
			severity: z
				.array(z.enum(INSIGHT_SEVERITIES))
				.optional()
				.describe("Filter by severity (e.g. ['critical','warning'])"),
			sentiment: z
				.array(z.enum(INSIGHT_SENTIMENTS))
				.optional()
				.describe("Filter by sentiment (e.g. ['negative'])"),
			since: z
				.enum(SINCE_PRESETS)
				.optional()
				.describe("Shorthand for createdAfter (overrides 'from' if provided)"),
			from: z.string().optional().describe("YYYY-MM-DD"),
			to: z.string().optional().describe("YYYY-MM-DD"),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.optional()
				.default(20)
				.describe("Max insights (1-100, default 20)"),
		}),
		resolveWebsite: "optional",
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const orgIds = await resolveOrganizationIds(ctx.websiteId, ctx);
		if (orgIds instanceof Error) {
			throw new McpToolError("not_found", orgIds.message);
		}

		const sinceDate = input.since
			? parseSinceShorthand(input.since)
			: undefined;
		let createdAfter: Date | undefined = sinceDate;
		let createdBefore: Date | undefined;
		if (input.from) {
			if (!isValidDate(input.from)) {
				throw new McpToolError("invalid_input", "from must be YYYY-MM-DD");
			}
			if (!createdAfter) {
				createdAfter = dayjs(input.from).startOf("day").toDate();
			}
		}
		if (input.to) {
			if (!isValidDate(input.to)) {
				throw new McpToolError("invalid_input", "to must be YYYY-MM-DD");
			}
			createdBefore = dayjs(input.to).endOf("day").toDate();
		}

		const rows = await cachedFetchInsightsForOrgs({
			organizationIds: [...orgIds].sort(),
			websiteId: ctx.websiteId,
			types: input.type,
			severities: input.severity,
			sentiments: input.sentiment,
			createdAfter,
			createdBefore,
			limit: input.limit,
		});

		if (rows.length === 0) {
			return {
				insights: [],
				count: 0,
				scope: ctx.websiteId ? "website" : "organization",
				hint: "No insights found for these filters. Try widening 'since' or removing type/severity filters.",
			};
		}

		return {
			insights: rows.map(mapInsightRow),
			count: rows.length,
			scope: ctx.websiteId ? "website" : "organization",
		};
	}
);

// ---------------------------------------------------------------------------
// summarize_insights
// ---------------------------------------------------------------------------

const summarizeInsightsTool = defineMcpTool(
	{
		name: "summarize_insights",
		description:
			"Compact triage view: counts by severity/type/sentiment plus top 3 priorities. Defaults to org-wide. Use this before list_insights when you only need a quick status.",
		inputSchema: z.object({
			websiteId: z.string().optional(),
			websiteName: z.string().optional(),
			websiteDomain: z.string().optional(),
			since: z
				.enum(SINCE_PRESETS)
				.optional()
				.default("last_7d")
				.describe("How far back to look (default last_7d)"),
		}),
		resolveWebsite: "optional",
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const orgIds = await resolveOrganizationIds(ctx.websiteId, ctx);
		if (orgIds instanceof Error) {
			throw new McpToolError("not_found", orgIds.message);
		}

		const createdAfter = parseSinceShorthand(input.since);

		const rows = await cachedFetchInsightsForOrgs({
			organizationIds: [...orgIds].sort(),
			websiteId: ctx.websiteId,
			createdAfter,
			limit: INSIGHTS_LIST_FETCH_LIMIT,
		});

		const bySeverity: Record<string, number> = {
			critical: 0,
			warning: 0,
			info: 0,
		};
		const bySentiment: Record<string, number> = {
			positive: 0,
			neutral: 0,
			negative: 0,
		};
		const byType: Record<string, number> = {};
		const byWebsite: Record<
			string,
			{ websiteName: string | null; websiteDomain: string; count: number }
		> = {};

		for (const r of rows) {
			bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
			bySentiment[r.sentiment] = (bySentiment[r.sentiment] ?? 0) + 1;
			byType[r.type] = (byType[r.type] ?? 0) + 1;
			const w = byWebsite[r.websiteId];
			if (w) {
				w.count += 1;
			} else {
				byWebsite[r.websiteId] = {
					websiteName: r.websiteName,
					websiteDomain: r.websiteDomain,
					count: 1,
				};
			}
		}

		const topPriorities = rows
			.slice()
			.sort((a, b) => b.priority - a.priority)
			.slice(0, 3)
			.map((r) => ({
				id: r.id,
				priority: r.priority,
				severity: r.severity,
				title: r.title,
				websiteDomain: r.websiteDomain,
			}));

		return {
			scope: ctx.websiteId ? "website" : "organization",
			since: input.since,
			total: rows.length,
			bySeverity,
			bySentiment,
			byType,
			byWebsite,
			topPriorities,
			hint:
				rows.length === 0
					? "No insights in this window. Try a wider 'since' or call list_insights with no filters."
					: undefined,
		};
	}
);

// ---------------------------------------------------------------------------
// compare_metric
// ---------------------------------------------------------------------------

const compareMetricTool = defineMcpTool(
	{
		name: "compare_metric",
		description:
			"Compare one metric (visitors, sessions, pageviews, bounce_rate, session_duration, events) across two periods for a website. Auto-computes delta and previous period. Use instead of two get_data calls.",
		inputSchema: z.object({
			websiteId: z.string().optional(),
			websiteName: z.string().optional(),
			websiteDomain: z.string().optional(),
			metric: z
				.enum(METRIC_KEYS)
				.describe(
					"One of: visitors, sessions, pageviews, bounce_rate, session_duration, events"
				),
			period: z
				.enum(PERIOD_PRESETS)
				.optional()
				.describe("Date preset for the current window (default last_7d)"),
			from: z.string().optional().describe("Custom current start YYYY-MM-DD"),
			to: z.string().optional().describe("Custom current end YYYY-MM-DD"),
			compareTo: z
				.object({
					from: z.string(),
					to: z.string(),
				})
				.optional()
				.describe(
					"Custom comparison window. Defaults to the period immediately preceding 'current'."
				),
			timezone: z.string().optional().describe("IANA timezone (default UTC)"),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const websiteId = ctx.websiteId as string;
		const websiteDomain = ctx.websiteDomain ?? "unknown";
		const timezone = input.timezone ?? "UTC";

		const def = METRIC_REGISTRY[input.metric];
		if (!def) {
			throw new McpToolError(
				"invalid_input",
				`Unknown metric: ${input.metric}. Valid: ${METRIC_KEYS.join(", ")}`
			);
		}

		const currentRange = resolvePeriodRange({
			period: input.period,
			from: input.from,
			to: input.to,
		});
		if (currentRange instanceof Error) {
			throw new McpToolError("invalid_input", currentRange.message);
		}

		let compareRange: { from: string; to: string };
		if (input.compareTo) {
			if (
				!(isValidDate(input.compareTo.from) && isValidDate(input.compareTo.to))
			) {
				throw new McpToolError(
					"invalid_input",
					"compareTo.from and compareTo.to must be YYYY-MM-DD"
				);
			}
			compareRange = input.compareTo;
		} else {
			compareRange = computePreviousPeriod(currentRange);
		}

		const [currentRows, previousRows] = await Promise.all([
			executeQuery(
				{
					projectId: websiteId,
					type: def.queryType,
					from: currentRange.from,
					to: currentRange.to,
					timezone,
				},
				websiteDomain,
				timezone
			),
			executeQuery(
				{
					projectId: websiteId,
					type: def.queryType,
					from: compareRange.from,
					to: compareRange.to,
					timezone,
				},
				websiteDomain,
				timezone
			),
		]);

		const currentValue = Number(
			(currentRows[0] as Record<string, unknown> | undefined)?.[def.field] ?? 0
		);
		const previousValue = Number(
			(previousRows[0] as Record<string, unknown> | undefined)?.[def.field] ?? 0
		);

		const direction = deltaDirection(currentValue, previousValue);
		const deltaPct = safeDeltaPercent(currentValue, previousValue);
		const isImprovement =
			direction === "flat"
				? null
				: def.betterWhen === "higher"
					? direction === "up"
					: direction === "down";

		return {
			metric: input.metric,
			label: def.label,
			format: def.format,
			betterWhen: def.betterWhen,
			currentPeriod: currentRange,
			comparePeriod: compareRange,
			current: currentValue,
			previous: previousValue,
			delta: currentValue - previousValue,
			deltaPercent: Number(deltaPct.toFixed(2)),
			direction,
			isImprovement,
			headline: buildMetricHeadline(
				def.label,
				currentValue,
				previousValue,
				def.format
			),
			websiteId,
			websiteDomain,
		};
	}
);

// ---------------------------------------------------------------------------
// top_movers
// ---------------------------------------------------------------------------

interface DimensionRow {
	name?: unknown;
	pageviews?: unknown;
	visitors?: unknown;
}

const TOP_MOVERS_DEFAULT_LIMIT = 10;
const TOP_MOVERS_MAX_LIMIT = 50;
const TOP_MOVERS_FETCH_LIMIT = 100;

const topMoversTool = defineMcpTool(
	{
		name: "top_movers",
		description:
			"Top dimension rows (pages, referrers, countries, browsers, os) that changed the most between two periods. Direct answer to 'which page changed the most' / 'which referrer surged'.",
		inputSchema: z.object({
			websiteId: z.string().optional(),
			websiteName: z.string().optional(),
			websiteDomain: z.string().optional(),
			dimension: z
				.enum(DIMENSION_KEYS)
				.describe("One of: pages, referrers, countries, browsers, os"),
			metric: z
				.enum(["visitors", "pageviews"])
				.optional()
				.default("visitors")
				.describe("Which metric to rank by (default visitors)"),
			period: z
				.enum(PERIOD_PRESETS)
				.optional()
				.describe("Current window preset (default last_7d)"),
			from: z.string().optional(),
			to: z.string().optional(),
			compareTo: z
				.object({ from: z.string(), to: z.string() })
				.optional()
				.describe("Custom comparison window. Default = previous period."),
			limit: z
				.number()
				.int()
				.min(1)
				.max(TOP_MOVERS_MAX_LIMIT)
				.optional()
				.default(TOP_MOVERS_DEFAULT_LIMIT),
			direction: z
				.enum(["up", "down", "both"])
				.optional()
				.default("both")
				.describe("Filter to gainers / losers / both"),
			timezone: z.string().optional(),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const websiteId = ctx.websiteId as string;
		const websiteDomain = ctx.websiteDomain ?? "unknown";
		const timezone = input.timezone ?? "UTC";
		const def = DIMENSION_REGISTRY[input.dimension];
		if (!def) {
			throw new McpToolError(
				"invalid_input",
				`Unknown dimension: ${input.dimension}`
			);
		}

		const currentRange = resolvePeriodRange({
			period: input.period,
			from: input.from,
			to: input.to,
		});
		if (currentRange instanceof Error) {
			throw new McpToolError("invalid_input", currentRange.message);
		}

		let compareRange: { from: string; to: string };
		if (input.compareTo) {
			if (
				!(isValidDate(input.compareTo.from) && isValidDate(input.compareTo.to))
			) {
				throw new McpToolError(
					"invalid_input",
					"compareTo.from and compareTo.to must be YYYY-MM-DD"
				);
			}
			compareRange = input.compareTo;
		} else {
			compareRange = computePreviousPeriod(currentRange);
		}

		const [currentRows, previousRows] = await Promise.all([
			executeQuery(
				{
					projectId: websiteId,
					type: def.queryType,
					from: currentRange.from,
					to: currentRange.to,
					timezone,
					limit: TOP_MOVERS_FETCH_LIMIT,
				},
				websiteDomain,
				timezone
			),
			executeQuery(
				{
					projectId: websiteId,
					type: def.queryType,
					from: compareRange.from,
					to: compareRange.to,
					timezone,
					limit: TOP_MOVERS_FETCH_LIMIT,
				},
				websiteDomain,
				timezone
			),
		]);

		const metricField = input.metric;
		const merged = new Map<
			string,
			{ name: string; current: number; previous: number }
		>();

		for (const r of currentRows as DimensionRow[]) {
			const name = String(r.name ?? "").trim();
			if (!name) {
				continue;
			}
			const value = Number(r[metricField] ?? 0);
			merged.set(name, { name, current: value, previous: 0 });
		}
		for (const r of previousRows as DimensionRow[]) {
			const name = String(r.name ?? "").trim();
			if (!name) {
				continue;
			}
			const value = Number(r[metricField] ?? 0);
			const existing = merged.get(name);
			if (existing) {
				existing.previous = value;
			} else {
				merged.set(name, { name, current: 0, previous: value });
			}
		}

		const movers = [...merged.values()]
			.filter((m) => m.current !== 0 || m.previous !== 0)
			.map((m) => ({
				name: m.name,
				current: m.current,
				previous: m.previous,
				delta: m.current - m.previous,
				deltaPercent: Number(
					safeDeltaPercent(m.current, m.previous).toFixed(2)
				),
				direction: deltaDirection(m.current, m.previous),
				headline: buildDimensionHeadline(
					def.label,
					m.name,
					input.metric,
					m.current,
					m.previous
				),
			}))
			.filter((m) => {
				if (input.direction === "up") {
					return m.direction === "up";
				}
				if (input.direction === "down") {
					return m.direction === "down";
				}
				return m.direction !== "flat";
			})
			.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
			.slice(0, input.limit);

		return {
			dimension: input.dimension,
			dimensionLabel: def.label,
			metric: input.metric,
			currentPeriod: currentRange,
			comparePeriod: compareRange,
			count: movers.length,
			movers,
			hint:
				movers.length === 0
					? "No movers found. Try a longer period or a different dimension."
					: undefined,
			websiteId,
			websiteDomain,
		};
	}
);

// ---------------------------------------------------------------------------
// detect_anomalies
// ---------------------------------------------------------------------------

interface DailyRow {
	bounce_rate?: unknown;
	date?: unknown;
	median_session_duration?: unknown;
	pageviews?: unknown;
	sessions?: unknown;
	visitors?: unknown;
}

const detectAnomaliesTool = defineMcpTool(
	{
		name: "detect_anomalies",
		description:
			"Find statistical anomalies in summary metrics over the last N days using z-scores. Returns metrics where the latest day deviates beyond the threshold from the rolling baseline.",
		inputSchema: z.object({
			websiteId: z.string().optional(),
			websiteName: z.string().optional(),
			websiteDomain: z.string().optional(),
			lookbackDays: z
				.number()
				.int()
				.min(7)
				.max(60)
				.optional()
				.default(14)
				.describe("Days of history to compute baseline (7-60, default 14)"),
			threshold: z
				.number()
				.min(1.0)
				.max(5.0)
				.optional()
				.default(2.0)
				.describe("Absolute z-score threshold (1.0-5.0, default 2.0)"),
			timezone: z.string().optional(),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 30, windowSec: 60 },
	},
	async (input, ctx) => {
		const websiteId = ctx.websiteId as string;
		const websiteDomain = ctx.websiteDomain ?? "unknown";
		const timezone = input.timezone ?? "UTC";
		const lookbackDays = input.lookbackDays;
		const threshold = input.threshold;

		const today = dayjs();
		const from = today.subtract(lookbackDays - 1, "day").format("YYYY-MM-DD");
		const to = today.format("YYYY-MM-DD");

		const rows = (await executeQuery(
			{
				projectId: websiteId,
				type: "events_by_date",
				from,
				to,
				timezone,
				timeUnit: "day",
				limit: lookbackDays + 5,
			},
			websiteDomain,
			timezone
		)) as DailyRow[];

		if (rows.length < 7) {
			return {
				websiteId,
				lookbackDays,
				threshold,
				count: 0,
				anomalies: [],
				hint: `Insufficient data: need at least 7 days, got ${rows.length}.`,
			};
		}

		const sorted = [...rows].sort((a, b) =>
			String(a.date ?? "").localeCompare(String(b.date ?? ""))
		);
		const latest = sorted.at(-1);
		const baseline = sorted.slice(0, -1);

		if (!latest) {
			return {
				websiteId,
				lookbackDays,
				threshold,
				count: 0,
				anomalies: [],
				hint: "No data available for the latest day.",
			};
		}

		const anomalies = ANOMALY_METRICS.flatMap((metric) => {
			const baselineValues = baseline
				.map((r) => Number(r[metric.field as keyof DailyRow] ?? 0))
				.filter((v) => Number.isFinite(v));
			if (baselineValues.length < 6) {
				return [];
			}
			const baselineMean = mean(baselineValues);
			const baselineStddev = stddev(baselineValues);
			if (baselineStddev === 0) {
				return [];
			}
			const currentValue = Number(latest[metric.field as keyof DailyRow] ?? 0);
			const zScore = (currentValue - baselineMean) / baselineStddev;
			if (Math.abs(zScore) < threshold) {
				return [];
			}
			const def = METRIC_REGISTRY[metric.key];
			const format: MetricFormat = def?.format ?? "number";
			return [
				{
					metric: metric.key,
					label: metric.label,
					direction: deltaDirection(currentValue, baselineMean),
					current: currentValue,
					baseline: Number(baselineMean.toFixed(2)),
					stddev: Number(baselineStddev.toFixed(2)),
					zScore: Number(zScore.toFixed(2)),
					deltaPercent: Number(
						safeDeltaPercent(currentValue, baselineMean).toFixed(2)
					),
					format,
					headline: buildAnomalyHeadline(
						metric.label,
						currentValue,
						baselineMean,
						zScore,
						format
					),
				},
			];
		}).sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

		return {
			websiteId,
			websiteDomain,
			lookbackDays,
			threshold,
			latestDay: String(latest.date ?? ""),
			baselineDays: baseline.length,
			count: anomalies.length,
			anomalies,
			hint:
				anomalies.length === 0
					? `No metrics deviated beyond ${threshold}σ. Try lowering threshold or expanding lookbackDays.`
					: undefined,
		};
	}
);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const INSIGHT_TOOL_FACTORIES: McpToolFactory[] = [
	listInsightsTool,
	summarizeInsightsTool,
	compareMetricTool,
	topMoversTool,
	detectAnomaliesTool,
];

export const INSIGHT_TOOL_NAMES = [
	"list_insights",
	"summarize_insights",
	"compare_metric",
	"top_movers",
	"detect_anomalies",
] as const;
