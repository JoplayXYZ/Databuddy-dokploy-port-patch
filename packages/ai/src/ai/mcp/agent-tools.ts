import type { ApiKeyRow } from "@databuddy/api-keys/resolve";
import { auth } from "@databuddy/auth";
import {
	AGENT_SQL_VALIDATION_ERROR,
	requiresTenantFilter,
	validateAgentSQL,
} from "@databuddy/db/clickhouse";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getAccessibleWebsites } from "../../lib/accessible-websites";
import { getWebsiteDomain } from "../../lib/website-utils";
import { executeBatch, executeQuery, QueryBuilders } from "../../query";
import type { Filter, QueryRequest } from "../../query/types";
import type { AppToolMode } from "../config/context";
import { createAnnotationTools } from "../tools/annotations";
import { createFlagTools } from "../tools/flags";
import { createFunnelTools } from "../tools/funnels";
import { createGoalTools } from "../tools/goals";
import { createLinksTools } from "../tools/links";
import { createMemoryTools } from "../tools/memory";
import { createProfileTools } from "../tools/profiles";
import { executeTimedQuery } from "../tools/utils";
import { buildBatchQueryRequests, MCP_DATE_PRESETS } from "./mcp-utils";
import {
	createSlackConversationTools,
	type DatabuddyAgentSlackContext,
} from "./slack-context";
import { ensureWebsiteAccess } from "./tool-context";

export interface McpAgentContext {
	apiKey: ApiKeyRow | null;
	organizationId?: string | null;
	requestHeaders: Headers;
	toolMode?: AppToolMode;
	userId: string | null;
}

const FilterSchema = z.object({
	field: z.string(),
	op: z.enum([
		"eq",
		"ne",
		"contains",
		"not_contains",
		"starts_with",
		"in",
		"not_in",
	]),
	value: z.union([
		z.string(),
		z.number(),
		z.array(z.union([z.string(), z.number()])),
	]),
	target: z.string().optional(),
	having: z.boolean().optional(),
}) satisfies z.ZodType<Filter>;

function getContext(ctx: unknown): McpAgentContext {
	if (!ctx || typeof ctx !== "object" || !("requestHeaders" in ctx)) {
		throw new Error(
			"MCP agent tools require context with requestHeaders and apiKey"
		);
	}
	return ctx as McpAgentContext;
}

export function createMcpAgentTools(
	options: { slackContext?: DatabuddyAgentSlackContext | null } = {}
): ToolSet {
	return {
		list_websites: tool({
			description:
				"List all websites accessible with the current API key. Call this FIRST to discover website IDs before any analytics query. Required before execute_query_builder or execute_sql_query.",
			strict: true,
			inputSchema: z.object({}),
			execute: async (_args, options) => {
				const experimental_context = (
					options as { experimental_context?: unknown }
				).experimental_context;
				const ctx = getContext(experimental_context);
				if (ctx.toolMode === "eval-fixtures") {
					return {
						total: 2,
						websites: [
							{
								domain: "databuddy.cc",
								id: "OXmNQsViBT-FOS_wZCTHc",
								isPublic: false,
								name: "Databuddy",
							},
							{
								domain: "docs.databuddy.cc",
								id: "eval_docs_website",
								isPublic: true,
								name: "Databuddy Docs",
							},
						],
					};
				}
				const session = ctx.userId
					? await auth.api.getSession({ headers: ctx.requestHeaders })
					: null;
				const authCtx = {
					apiKey: ctx.apiKey,
					organizationId: ctx.organizationId ?? ctx.apiKey?.organizationId,
					user: session?.user
						? {
								id: session.user.id,
								role: (session.user as { role?: string }).role,
							}
						: ctx.userId
							? { id: ctx.userId }
							: null,
				};
				const list = await getAccessibleWebsites(authCtx);
				return {
					websites: list.map((w) => ({
						id: w.id,
						name: w.name,
						domain: w.domain,
						isPublic: w.isPublic,
					})),
					total: list.length,
				};
			},
		}),
		execute_query_builder: tool({
			description: `Pre-built analytics queries. Types: ${Object.keys(QueryBuilders).join(", ")}. Preferred for traffic, sessions, devices, etc.`,
			strict: true,
			inputSchema: z.object({
				websiteId: z.string(),
				type: z.string(),
				from: z.string(),
				to: z.string(),
				timeUnit: z.enum(["minute", "hour", "day", "week", "month"]).optional(),
				filters: z.array(FilterSchema).optional(),
				groupBy: z.array(z.string()).optional(),
				orderBy: z.string().optional(),
				limit: z.number().min(1).max(1000).optional(),
				offset: z.number().min(0).optional(),
				timezone: z.string().optional(),
			}),
			execute: async (args, options) => {
				const experimental_context = (
					options as { experimental_context?: unknown }
				).experimental_context;
				const ctx = getContext(experimental_context);
				if (ctx.toolMode === "eval-fixtures") {
					const data = getEvalAnalyticsRows(args.type);
					return { data, rowCount: data.length, type: args.type };
				}
				const access = await ensureWebsiteAccess(
					args.websiteId,
					ctx.requestHeaders,
					ctx.apiKey
				);
				if (access instanceof Error) {
					throw new Error(access.message);
				}
				const websiteDomain =
					(await getWebsiteDomain(args.websiteId)) ?? "unknown";
				const queryRequest: QueryRequest = {
					projectId: args.websiteId,
					type: args.type,
					from: args.from,
					to: args.to,
					timeUnit: args.timeUnit,
					filters: args.filters,
					groupBy: args.groupBy,
					orderBy: args.orderBy,
					limit: args.limit,
					offset: args.offset,
					timezone: args.timezone ?? "UTC",
				};
				const data = await executeQuery(
					queryRequest,
					websiteDomain,
					queryRequest.timezone
				);
				return { data, rowCount: data.length, type: args.type };
			},
		}),
		execute_sql_query: tool({
			description:
				"Custom read-only ClickHouse SQL. SELECT/WITH only. Use {paramName:Type} for parameters. websiteId is auto-included.",
			strict: true,
			inputSchema: z.object({
				websiteId: z.string(),
				sql: z.string(),
				params: z.record(z.string(), z.unknown()).optional(),
			}),
			execute: async (args, options) => {
				const { websiteId, sql, params } = args;
				const experimental_context = (
					options as { experimental_context?: unknown }
				).experimental_context;
				const ctx = getContext(experimental_context);
				if (ctx.toolMode === "eval-fixtures") {
					return {
						data: [
							{
								note: "Eval fixture SQL result",
								page: "/pricing",
								value: 42,
							},
						],
						rowCount: 1,
					};
				}
				const access = await ensureWebsiteAccess(
					websiteId,
					ctx.requestHeaders,
					ctx.apiKey
				);
				if (access instanceof Error) {
					throw new Error(access.message);
				}
				const validation = validateAgentSQL(sql);
				if (!validation.valid) {
					throw new Error(validation.reason ?? AGENT_SQL_VALIDATION_ERROR);
				}
				if (!requiresTenantFilter(sql)) {
					throw new Error(
						"Query must include tenant isolation: WHERE client_id = {websiteId:String}"
					);
				}
				const result = await executeTimedQuery(
					"MCP Agent SQL",
					sql,
					{ websiteId, ...(params ?? {}) },
					{ websiteId }
				);
				return result;
			},
		}),
		get_data: tool({
			description: `Run 1-10 analytics queries in one call. PREFERRED when user asks for one or many metrics (traffic + top pages + referrers, etc). Types: ${Object.keys(QueryBuilders).join(", ")}. Use preset (e.g. last_7d, last_30d) or from/to dates. Supports filters (e.g. os_name eq "Mac" for slowest page for Mac users), groupBy, orderBy.`,
			strict: true,
			inputSchema: z.object({
				websiteId: z.string(),
				queries: z
					.array(
						z.object({
							type: z.string(),
							preset: z
								.enum(MCP_DATE_PRESETS as [string, ...string[]])
								.optional(),
							from: z.string().optional(),
							to: z.string().optional(),
							timeUnit: z
								.enum(["minute", "hour", "day", "week", "month"])
								.optional(),
							limit: z.number().min(1).max(1000).optional(),
							filters: z.array(FilterSchema).optional(),
							groupBy: z.array(z.string()).optional(),
							orderBy: z.string().optional(),
						})
					)
					.min(1)
					.max(10),
				timezone: z.string().optional().default("UTC"),
			}),
			execute: async (args, options) => {
				const experimental_context = (
					options as { experimental_context?: unknown }
				).experimental_context;
				const ctx = getContext(experimental_context);
				if (ctx.toolMode === "eval-fixtures") {
					return {
						batch: true,
						results: args.queries.map((query) => {
							const data = getEvalAnalyticsRows(query.type);
							return {
								type: query.type,
								data,
								rowCount: data.length,
							};
						}),
					};
				}
				const access = await ensureWebsiteAccess(
					args.websiteId,
					ctx.requestHeaders,
					ctx.apiKey
				);
				if (access instanceof Error) {
					throw new Error(access.message);
				}
				const buildResult = buildBatchQueryRequests(
					args.queries,
					args.websiteId,
					args.timezone ?? "UTC"
				);
				if ("error" in buildResult) {
					throw new Error(buildResult.error);
				}
				const websiteDomain =
					(await getWebsiteDomain(args.websiteId)) ?? "unknown";
				const results = await executeBatch(buildResult.requests, {
					websiteDomain,
					timezone: args.timezone ?? "UTC",
				});
				return {
					batch: true,
					results: results.map((r) => ({
						type: r.type,
						data: r.data,
						rowCount: r.data.length,
						...(r.error && { error: "Query failed" }),
					})),
				};
			},
		}),
		...createMemoryTools(),
		...createProfileTools(),
		...createFlagTools(),
		...createFunnelTools(),
		...createGoalTools(),
		...createAnnotationTools(),
		...createLinksTools(),
		...createSlackConversationTools(options.slackContext),
	};
}

function getEvalAnalyticsRows(type: string): Record<string, unknown>[] {
	switch (type) {
		case "summary_metrics":
			return [
				{
					bounce_rate: 5.02,
					pageviews: 11_375,
					sessions: 1992,
					unique_visitors: 1465,
				},
			];
		case "top_pages":
			return [
				{ page: "/demo", pageviews: 1342, visitors: 914 },
				{ page: "/demo/errors", pageviews: 1070, visitors: 809 },
				{ page: "/pricing", pageviews: 319, visitors: 218 },
			];
		case "top_referrers":
		case "traffic_sources":
			return [
				{ referrer: "databuddy.cc", visitors: 850 },
				{ referrer: "direct", visitors: 570 },
				{ referrer: "google", visitors: 42 },
			];
		case "device_types":
			return [
				{ device_type: "mobile", visitors: 610 },
				{ device_type: "desktop", visitors: 520 },
				{ device_type: "tablet", visitors: 35 },
			];
		case "error_summary":
			return [
				{
					affected_users: 109,
					error_rate: 6.08,
					total_errors: 199,
					unique_errors: 5,
				},
			];
		case "errors_by_page":
			return [
				{ errors: 37, page: "/pricing" },
				{ errors: 22, page: "/demo/errors" },
			];
		case "error_types":
		case "errors_by_type":
			return [
				{ count: 88, type: "HydrationError" },
				{ count: 43, type: "PaymentFormError" },
			];
		case "vitals_overview":
		case "vitals_by_page":
		case "slow_pages":
		case "page_performance":
			return [
				{ lcp_p75: 4.9, page: "/", visitors: 610 },
				{ lcp_p75: 3.8, page: "/pricing", visitors: 218 },
			];
		case "custom_events_summary":
		case "events_by_date":
			return [
				{ count: 420, event: "signup_started" },
				{ count: 184, event: "signup_completed" },
			];
		default:
			return [
				{
					label: type,
					note: "Eval fixture analytics row",
					value: 1,
				},
			];
	}
}
