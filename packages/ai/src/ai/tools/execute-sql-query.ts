import {
	AGENT_SQL_VALIDATION_ERROR,
	buildAdditionalTableFilters,
	extractAllowlistedTables,
	validateAgentSQL,
} from "@databuddy/db/clickhouse";
import { tool } from "ai";
import { z } from "zod";
import { executeTimedQuery, getAppContext, type QueryResult } from "./utils";

const MAX_MODEL_ROWS = 50;

/**
 * ClickHouse per-query safety caps applied to every agent SQL execution.
 * Layered on top of `readonly: true` (already enforced by chQuery) and the
 * per-tenant `additional_table_filters`. These bound resource consumption so
 * a pathological agent query (runaway JOIN, missing predicate, prompt
 * injection) can't degrade the cluster.
 *
 * Sized for analytics queries scoped to a single tenant. Calibrate against
 * system.query_log p99 if numbers turn out wrong in practice.
 */
const AGENT_CH_SAFETY_SETTINGS: Record<string, string | number> = {
	/* wall-clock cap per query */
	max_execution_time: 30,
	timeout_overflow_mode: "throw",

	/* memory cap per query */
	max_memory_usage: 4_000_000_000,

	/* read-budget: scan ceiling. Throw if exceeded so bad queries fail loudly. */
	max_rows_to_read: 500_000_000,
	max_bytes_to_read: 50_000_000_000,
	read_overflow_mode: "throw",

	/* result-budget: silently truncate to keep payloads sane. The TS layer
	   slices to MAX_MODEL_ROWS = 50 anyway; this is the engine safety net. */
	max_result_rows: 10_000,
	max_result_bytes: 50_000_000,
	result_overflow_mode: "break",

	/* per-shard caps for the distributed cluster */
	max_rows_to_read_leaf: 200_000_000,
	max_bytes_to_read_leaf: 20_000_000_000,

	/* AST-size guards against pathological generated SQL */
	max_ast_depth: 1000,
	max_ast_elements: 50_000,
	max_expanded_ast_elements: 500_000,
};

function withServerBoundIds(
	params: Record<string, unknown> | undefined,
	websiteId: string,
	websiteDomain: string | undefined
): Record<string, unknown> {
	const { websiteId: _, websiteDomain: __, ...rest } = params ?? {};
	return websiteDomain
		? { ...rest, websiteId, websiteDomain }
		: { ...rest, websiteId };
}

export async function executeAgentSqlForWebsite({
	websiteId,
	websiteDomain,
	sql,
	params,
	toolName = "Execute SQL Tool",
}: {
	websiteId: string;
	websiteDomain?: string;
	sql: string;
	params?: Record<string, unknown>;
	toolName?: string;
}): Promise<QueryResult> {
	const validation = validateAgentSQL(sql);
	if (!validation.valid) {
		throw new Error(validation.reason ?? AGENT_SQL_VALIDATION_ERROR);
	}

	const referencedTables = extractAllowlistedTables(sql);
	const additional_table_filters = buildAdditionalTableFilters(
		referencedTables,
		websiteId
	);

	const result = await executeTimedQuery(
		toolName,
		sql,
		withServerBoundIds(params, websiteId, websiteDomain),
		{ websiteId },
		{ ...AGENT_CH_SAFETY_SETTINGS, additional_table_filters }
	);

	return result.data.length > MAX_MODEL_ROWS
		? { ...result, data: result.data.slice(0, MAX_MODEL_ROWS) }
		: result;
}

export const executeSqlQueryTool = tool({
	description: `Use only for explicit analytics questions that cannot be answered by get_data query builders, such as session-level joins, ordered path analysis, or cross-table correlations. Do not use for greetings, thanks, acknowledgments, short reactions, clarification-only replies, frustration, or meta-conversation about the assistant/chat. Read-only ClickHouse SQL (SELECT/WITH only). Must use {paramName:Type} placeholders (no string interpolation) and filter by client_id = {websiteId:String} AND-ed at the top level of every WHERE clause. The current website is bound server-side; tool arguments named websiteId or websiteDomain are ignored. UNION, INTERSECT, EXCEPT, subqueries, and comma-joins are not allowed — use CTEs (WITH ... AS (...)) instead.

Canonical analytics.events schema: client_id, anonymous_id, session_id, time, path, referrer, browser_name, os_name, device_type, country, region, city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, load_time, time_on_page, scroll_depth, properties, event_name.

Critical schema footguns: website id column is client_id (not website_id); timestamp is time (not created_at); page URL path is path (not page_path); event discriminator is event_name (not event_type); pageviews are event_name = 'screen_view' (never 'pageview').

Other tables: analytics.error_spans (client_id, session_id, timestamp, path, message, filename, lineno, stack, error_type), analytics.web_vitals_spans (client_id, timestamp, path, metric_name FCP/LCP/CLS/INP/TTFB/FPS, metric_value), analytics.outgoing_links (client_id, timestamp, path, href, text). Custom events are in analytics.custom_events and are easy to query incorrectly — use get_data custom_events_* builders instead. Prefer get_data query builders for anything they cover.`,
	strict: true,
	inputSchema: z.object({
		sql: z
			.string()
			.describe(
				"Read-only ClickHouse SELECT/WITH query for an explicit analytics request. Must include client_id = {websiteId:String} AND-ed at the top level of every SELECT's WHERE."
			),
		params: z
			.record(z.string(), z.unknown())
			.optional()
			.describe(
				"Optional typed placeholder values. websiteId and websiteDomain are bound by the server and cannot be overridden."
			),
	}),
	execute: ({ sql, params }, options): Promise<QueryResult> => {
		const ctx = getAppContext(options);
		return executeAgentSqlForWebsite({
			websiteId: ctx.websiteId,
			websiteDomain: ctx.websiteDomain,
			sql,
			params,
		});
	},
});
