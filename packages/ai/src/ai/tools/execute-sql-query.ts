import {
	AGENT_SQL_VALIDATION_ERROR,
	requiresTenantFilter,
	validateAgentSQL,
} from "@databuddy/db/clickhouse";
import { tool } from "ai";
import { z } from "zod";
import { executeTimedQuery, type QueryResult } from "./utils";

export const executeSqlQueryTool = tool({
	description: `Use only for explicit analytics questions that cannot be answered by get_data query builders, such as session-level joins, ordered path analysis, or cross-table correlations. Do not use for greetings, thanks, acknowledgments, short reactions, clarification-only replies, frustration, or meta-conversation about the assistant/chat. Read-only ClickHouse SQL (SELECT/WITH only). Must use {paramName:Type} placeholders (no string interpolation) and filter by client_id = {websiteId:String}. websiteId is auto-added to params.

Canonical analytics.events schema: client_id, anonymous_id, session_id, time, path, referrer, browser_name, os_name, device_type, country, region, city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, load_time, time_on_page, scroll_depth, properties, event_name.

Critical schema footguns: website id column is client_id (not website_id); timestamp is time (not created_at); page URL path is path (not page_path); event discriminator is event_name (not event_type); pageviews are event_name = 'screen_view' (never 'pageview').

Other tables: analytics.error_spans (client_id, session_id, timestamp, path, message, filename, lineno, stack, error_type), analytics.web_vitals_spans (client_id, timestamp, path, metric_name FCP/LCP/CLS/INP/TTFB/FPS, metric_value), analytics.outgoing_links (client_id, timestamp, path, href, text). Custom events are in analytics.custom_events and are easy to query incorrectly — use get_data custom_events_* builders instead. Prefer get_data query builders for anything they cover.`,
	strict: true,
	inputSchema: z.object({
		websiteId: z
			.string()
			.describe(
				"Website/client id to query. Automatically injected into params."
			),
		sql: z
			.string()
			.describe(
				"Read-only ClickHouse SELECT/WITH query for an explicit analytics request. Must include client_id = {websiteId:String}."
			),
		params: z
			.record(z.string(), z.unknown())
			.optional()
			.describe(
				"Optional typed placeholder values other than websiteId. Never interpolate user input into SQL strings."
			),
	}),
	execute: async ({ sql, websiteId, params }): Promise<QueryResult> => {
		const validation = validateAgentSQL(sql);
		if (!validation.valid) {
			throw new Error(validation.reason ?? AGENT_SQL_VALIDATION_ERROR);
		}

		if (!requiresTenantFilter(sql)) {
			throw new Error(
				"Query must include tenant isolation: WHERE client_id = {websiteId:String}"
			);
		}

		const result = await executeTimedQuery("Execute SQL Tool", sql, {
			websiteId,
			...(params ?? {}),
		});

		// Truncate large results to save context tokens.
		const MAX_MODEL_ROWS = 50;
		if (result.data.length > MAX_MODEL_ROWS) {
			return {
				...result,
				data: result.data.slice(0, MAX_MODEL_ROWS),
			};
		}

		return result;
	},
});
