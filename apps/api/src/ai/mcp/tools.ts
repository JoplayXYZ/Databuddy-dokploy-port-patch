import dayjs from "dayjs";
import { z } from "zod";
import { getAccessibleWebsites } from "../../lib/accessible-websites";
import {
	isMemoryEnabled,
	searchMemories,
	storeConversation as storeMemory,
} from "../../lib/supermemory";
import { getWebsiteDomain } from "../../lib/website-utils";
import { executeBatch } from "../../query";
import { callRPCProcedure } from "../tools/utils";
import {
	appendToConversation,
	getConversationHistory,
} from "./conversation-store";
import {
	defineMcpTool,
	McpToolError,
	type McpRequestContext,
	type McpToolFactory,
	type RegisteredMcpTool,
} from "./define-tool";
import { INSIGHT_TOOL_FACTORIES, INSIGHT_TOOL_NAMES } from "./insights-tools";
import {
	buildBatchQueryRequests,
	CLICKHOUSE_SCHEMA_DOCS,
	getQueryTypeDescriptions,
	getQueryTypeDetails,
	getSchemaSummary,
	MCP_DATE_PRESETS,
	type McpQueryItem,
} from "./mcp-utils";
import { runMcpAgent } from "./run-agent";
import {
	buildRpcContext,
	coerceQueriesArray,
	getOrganizationId,
} from "./tool-context";

const TIME_UNIT = ["minute", "hour", "day", "week", "month"] as const;

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
});

const QueryItemSchema = z.object({
	type: z.string(),
	preset: z.enum(MCP_DATE_PRESETS as [string, ...string[]]).optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	timeUnit: z.enum(TIME_UNIT).optional(),
	limit: z.number().min(1).max(1000).optional(),
	filters: z.array(FilterSchema).optional(),
	groupBy: z.array(z.string()).optional(),
	orderBy: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------

const askTool = defineMcpTool(
	{
		name: "ask",
		description:
			"Run a multi-step analytics agent on a free-form question. Use when the question is open-ended and you don't know which specific tool fits. Reuse conversationId for follow-ups.",
		inputSchema: z.object({
			question: z
				.string()
				.min(1)
				.max(2000)
				.describe("Your analytics question in natural language"),
			conversationId: z
				.string()
				.optional()
				.describe(
					"Pass from a previous ask response to continue the conversation"
				),
			timezone: z
				.string()
				.optional()
				.describe("IANA timezone (e.g. 'America/New_York'). Defaults to UTC."),
		}),
		rateLimit: { limit: 10, windowSec: 60 },
	},
	async (input, ctx) => {
		const conversationId = input.conversationId ?? crypto.randomUUID();
		const priorMessages = await getConversationHistory(
			conversationId,
			ctx.userId,
			ctx.apiKey
		);

		try {
			const answer = await runMcpAgent({
				question: input.question,
				requestHeaders: ctx.requestHeaders,
				apiKey: ctx.apiKey,
				userId: ctx.userId,
				timezone: input.timezone,
				conversationId,
				priorMessages: priorMessages.length > 0 ? priorMessages : undefined,
			});

			await appendToConversation(
				conversationId,
				ctx.userId,
				ctx.apiKey,
				input.question,
				answer,
				priorMessages
			);

			return { answer, conversationId };
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				throw new McpToolError(
					"upstream_timeout",
					"Request timed out. Try a simpler question or use get_data for direct queries."
				);
			}
			throw err;
		}
	}
);

// ---------------------------------------------------------------------------
// list_websites
// ---------------------------------------------------------------------------

const listWebsitesTool = defineMcpTool(
	{
		name: "list_websites",
		description:
			"List websites the caller can access. Use first to discover websiteIds before any tool that needs one.",
		inputSchema: z.object({}),
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (_input, ctx) => {
		const list = await getAccessibleWebsites({
			user: ctx.userId ? { id: ctx.userId } : null,
			apiKey: ctx.apiKey,
		});

		return {
			websites: list.map((w) => ({
				id: w.id,
				name: w.name,
				domain: w.domain,
				isPublic: w.isPublic,
			})),
			total: list.length,
		};
	}
);

// ---------------------------------------------------------------------------
// get_data
// ---------------------------------------------------------------------------

const getDataTool = defineMcpTool(
	{
		name: "get_data",
		description:
			"Run one or many analytics queries against a website. Single mode: type + preset/from/to. Batch mode: queries[] (2-10 items). Defaults to last_7d when no date is given.",
		inputSchema: z.object({
			websiteId: z
				.string()
				.optional()
				.describe("Website ID from list_websites"),
			websiteName: z
				.string()
				.optional()
				.describe("Website name. Alternative to websiteId."),
			websiteDomain: z
				.string()
				.optional()
				.describe("Website domain. Alternative to websiteId."),
			type: z
				.string()
				.optional()
				.describe(
					"Query type for single-query mode. Use capabilities to see all types."
				),
			preset: z
				.enum(MCP_DATE_PRESETS as [string, ...string[]])
				.optional()
				.describe(
					"Date preset (e.g. 'last_7d', 'last_30d'). Alternative to from/to."
				),
			from: z
				.string()
				.optional()
				.describe("Start date YYYY-MM-DD. Use with 'to'."),
			to: z
				.string()
				.optional()
				.describe("End date YYYY-MM-DD. Use with 'from'."),
			timeUnit: z
				.enum(TIME_UNIT)
				.optional()
				.describe("Time granularity for time-series data."),
			limit: z
				.number()
				.min(1)
				.max(1000)
				.optional()
				.describe("Max rows to return (1-1000)."),
			filters: z
				.array(FilterSchema)
				.optional()
				.describe(
					"Filters [{field, op, value}]. ops: eq, ne, contains, not_contains, starts_with, in, not_in."
				),
			groupBy: z.array(z.string()).optional().describe("Fields to group by."),
			orderBy: z.string().optional().describe("Field to order results by."),
			queries: z
				.array(QueryItemSchema)
				.min(2)
				.max(10)
				.optional()
				.describe(
					"Batch mode: 2-10 query items, each with type + preset or from/to. Omit 'type' when using this."
				),
			timezone: z
				.string()
				.optional()
				.describe("IANA timezone. Defaults to UTC."),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 30, windowSec: 60 },
	},
	async (input, ctx) => {
		const websiteId = ctx.websiteId as string;
		const timezone = input.timezone ?? "UTC";

		const rawQueries = input.queries
			? Array.isArray(input.queries)
				? input.queries
				: coerceQueriesArray(input.queries)
			: undefined;

		const items: McpQueryItem[] =
			rawQueries && rawQueries.length >= 2
				? (rawQueries as McpQueryItem[])
				: input.type
					? [
							{
								type: input.type,
								preset: input.preset,
								from: input.from,
								to: input.to,
								timeUnit: input.timeUnit,
								limit: input.limit,
								filters: input.filters,
								groupBy: input.groupBy,
								orderBy: input.orderBy,
							},
						]
					: [];

		if (items.length === 0) {
			throw new McpToolError(
				"invalid_input",
				"Either 'type' (single query) or 'queries' array (batch, 2-10 items) is required"
			);
		}

		const buildResult = buildBatchQueryRequests(items, websiteId, timezone);
		if ("error" in buildResult) {
			throw new McpToolError("invalid_input", buildResult.error);
		}
		const requests = buildResult.requests;
		const isBatch = requests.length > 1;

		const websiteDomain =
			ctx.websiteDomain ?? (await getWebsiteDomain(websiteId)) ?? "unknown";
		const results = await executeBatch(requests, {
			websiteDomain,
			timezone,
		});

		if (isBatch) {
			return {
				batch: true,
				results: results.map((r) => ({
					type: r.type,
					data: r.data,
					rowCount: r.data.length,
					...(r.error && { error: r.error }),
				})),
			};
		}

		const first = results[0];
		if (!first) {
			throw new McpToolError("internal", "No results returned");
		}
		return {
			data: first.data,
			rowCount: first.data.length,
			type: first.type,
			...(first.error && { error: first.error }),
		};
	}
);

// ---------------------------------------------------------------------------
// get_schema
// ---------------------------------------------------------------------------

const getSchemaTool = defineMcpTool(
	{
		name: "get_schema",
		description:
			"Return the ClickHouse analytics schema. Use only when writing custom SQL or when you need exact column names — query types in capabilities are usually enough.",
		inputSchema: z.object({}),
		rateLimit: { limit: 60, windowSec: 60 },
	},
	() => ({ schema: CLICKHOUSE_SCHEMA_DOCS })
);

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------

const capabilitiesTool = defineMcpTool(
	{
		name: "capabilities",
		description:
			"Return supported query types, allowed filters, date presets, and tool hints. Use first when unsure which tool or query type fits the question.",
		inputSchema: z.object({
			detail: z
				.enum(["summary", "full"])
				.optional()
				.default("summary")
				.describe(
					"'summary' returns type descriptions only; 'full' includes allowedFilters per type"
				),
		}),
		rateLimit: { limit: 60, windowSec: 60 },
	},
	(input) => {
		const useFull = input.detail === "full";
		const queryTypes = useFull
			? getQueryTypeDetails()
			: getQueryTypeDescriptions();
		const availableTools = [
			"ask",
			"list_websites",
			"get_data",
			"get_schema",
			"capabilities",
			"list_funnels",
			"get_funnel_analytics",
			"list_goals",
			"get_goal_analytics",
			"list_links",
			"search_links",
			...INSIGHT_TOOL_NAMES,
			...(isMemoryEnabled() ? ["search_memory", "save_memory"] : []),
		];

		return {
			queryTypes,
			schemaSummary: getSchemaSummary(),
			datePresets: MCP_DATE_PRESETS,
			dateFormat: "YYYY-MM-DD",
			maxLimit: 1000,
			availableTools,
			hints: [
				"get_data accepts websiteId, websiteName, or websiteDomain — no need to call list_websites first if you know the name or domain",
				"list_websites returns ids, names, and domains — use it when you need to discover available websites",
				"get_data batch: pass queries array (2-10 items, each with type + preset or from/to)",
				"get_data single: pass type + preset (e.g. last_30d) OR type + from + to (YYYY-MM-DD)",
				"get_data defaults to last_7d when preset/from/to omitted",
				"get_schema returns full ClickHouse schema — only needed for custom SQL, not for query builders",
				"capabilities with detail='full' shows allowedFilters per query type",
				"ask accepts optional timezone (IANA format) and returns conversationId for follow-ups",
				"list_funnels, list_goals, list_links are direct tools — no LLM cost, fast",
				"summarize_insights — fastest 'how are we doing' check; org-wide by default, returns counts + top 3 priorities",
				"list_insights — full insight rows with filtering; org-wide by default, pass websiteId/Name/Domain to scope",
				"compare_metric — week-over-week diff for visitors/sessions/pageviews/bounce_rate/session_duration/events; replaces 2 manual get_data calls",
				"top_movers — top pages/referrers/countries/browsers/os that changed the most between two periods",
				"detect_anomalies — z-score check on daily summary metrics for the last 7-60 days; finds spikes without needing pre-computed insights",
				"Use ask for complex questions; use direct tools for simple CRUD lookups",
				"Custom events: use custom_events_discovery to get events + properties + top values in one call",
				"Custom events: use filters [{field:'event_name',op:'eq',value:'your-event'}] to scope property queries to a specific event",
				"Custom events: use filters [{field:'property_key',op:'eq',value:'your-key'}] to scope property_top_values/distribution to a specific property",
			],
		};
	}
);

// ---------------------------------------------------------------------------
// list_funnels
// ---------------------------------------------------------------------------

const listFunnelsTool = defineMcpTool(
	{
		name: "list_funnels",
		description:
			"List funnels for a website with their steps and filters. Use before get_funnel_analytics or to enumerate available funnels.",
		inputSchema: z.object({
			websiteId: z.string().describe("Website ID from list_websites"),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const result = await callRPCProcedure(
			"funnels",
			"list",
			{ websiteId: input.websiteId },
			buildRpcContext(ctx)
		);
		const funnels = Array.isArray(result) ? result : [];
		if (funnels.length === 0) {
			return {
				funnels,
				count: 0,
				hint: "No funnels yet for this website. Create one in the dashboard.",
			};
		}
		return { funnels, count: funnels.length };
	}
);

// ---------------------------------------------------------------------------
// get_funnel_analytics
// ---------------------------------------------------------------------------

const getFunnelAnalyticsTool = defineMcpTool(
	{
		name: "get_funnel_analytics",
		description:
			"Return per-step conversion, drop-off, and timing for one funnel. Use after list_funnels to analyze a specific funnelId.",
		inputSchema: z.object({
			funnelId: z.string().describe("Funnel ID from list_funnels"),
			websiteId: z.string().describe("Website ID from list_websites"),
			from: z
				.string()
				.optional()
				.describe("Start date YYYY-MM-DD (defaults to 30 days ago)"),
			to: z
				.string()
				.optional()
				.describe("End date YYYY-MM-DD (defaults to today)"),
			startDate: z.string().optional().describe("Deprecated: use 'from'."),
			endDate: z.string().optional().describe("Deprecated: use 'to'."),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const startDate = input.from ?? input.startDate;
		const endDate = input.to ?? input.endDate;
		if (startDate && !dayjs(startDate).isValid()) {
			throw new McpToolError("invalid_input", "from must be YYYY-MM-DD");
		}
		if (endDate && !dayjs(endDate).isValid()) {
			throw new McpToolError("invalid_input", "to must be YYYY-MM-DD");
		}
		return await callRPCProcedure(
			"funnels",
			"getAnalytics",
			{
				funnelId: input.funnelId,
				websiteId: input.websiteId,
				startDate,
				endDate,
			},
			buildRpcContext(ctx)
		);
	}
);

// ---------------------------------------------------------------------------
// list_goals
// ---------------------------------------------------------------------------

const listGoalsTool = defineMcpTool(
	{
		name: "list_goals",
		description:
			"List conversion goals for a website with their type, target, and filters. Use before get_goal_analytics.",
		inputSchema: z.object({
			websiteId: z.string().describe("Website ID from list_websites"),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const result = await callRPCProcedure(
			"goals",
			"list",
			{ websiteId: input.websiteId },
			buildRpcContext(ctx)
		);
		const goals = Array.isArray(result) ? result : [];
		if (goals.length === 0) {
			return {
				goals,
				count: 0,
				hint: "No goals yet for this website. Create one in the dashboard.",
			};
		}
		return { goals, count: goals.length };
	}
);

// ---------------------------------------------------------------------------
// get_goal_analytics
// ---------------------------------------------------------------------------

const getGoalAnalyticsTool = defineMcpTool(
	{
		name: "get_goal_analytics",
		description:
			"Return entered/completed counts and conversion rate for one goalId. Use after list_goals.",
		inputSchema: z.object({
			goalId: z.string().describe("Goal ID from list_goals"),
			websiteId: z.string().describe("Website ID from list_websites"),
			from: z
				.string()
				.optional()
				.describe("Start date YYYY-MM-DD (defaults to 30 days ago)"),
			to: z
				.string()
				.optional()
				.describe("End date YYYY-MM-DD (defaults to today)"),
			startDate: z.string().optional().describe("Deprecated: use 'from'."),
			endDate: z.string().optional().describe("Deprecated: use 'to'."),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const startDate = input.from ?? input.startDate;
		const endDate = input.to ?? input.endDate;
		if (startDate && !dayjs(startDate).isValid()) {
			throw new McpToolError("invalid_input", "from must be YYYY-MM-DD");
		}
		if (endDate && !dayjs(endDate).isValid()) {
			throw new McpToolError("invalid_input", "to must be YYYY-MM-DD");
		}
		return await callRPCProcedure(
			"goals",
			"getAnalytics",
			{
				goalId: input.goalId,
				websiteId: input.websiteId,
				startDate,
				endDate,
			},
			buildRpcContext(ctx)
		);
	}
);

// ---------------------------------------------------------------------------
// list_links
// ---------------------------------------------------------------------------

interface LinkRow {
	createdAt: string;
	expiresAt: string | null;
	externalId: string | null;
	id: string;
	name: string;
	ogDescription: string | null;
	ogTitle: string | null;
	slug: string;
	targetUrl: string;
}

const listLinksTool = defineMcpTool(
	{
		name: "list_links",
		description:
			"List short links for the website's organization. Use to enumerate all links before referencing one.",
		inputSchema: z.object({
			websiteId: z.string().describe("Website ID from list_websites"),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const orgId = await getOrganizationId(input.websiteId);
		if (orgId instanceof Error) {
			throw new McpToolError("not_found", orgId.message);
		}
		const result = await callRPCProcedure(
			"links",
			"list",
			{ organizationId: orgId },
			buildRpcContext(ctx)
		);
		const links = (Array.isArray(result) ? result : []) as LinkRow[];
		if (links.length === 0) {
			return {
				links,
				count: 0,
				hint: "No links yet for this organization.",
			};
		}
		return {
			links: links.map((link) => ({
				id: link.id,
				name: link.name,
				slug: link.slug,
				targetUrl: link.targetUrl,
				externalId: link.externalId,
				expiresAt: link.expiresAt,
				createdAt: link.createdAt,
				ogTitle: link.ogTitle,
				ogDescription: link.ogDescription,
			})),
			count: links.length,
		};
	}
);

// ---------------------------------------------------------------------------
// search_links
// ---------------------------------------------------------------------------

const searchLinksTool = defineMcpTool(
	{
		name: "search_links",
		description:
			"Find short links matching a substring on name, slug, target URL, or external ID. Use when you know part of a link identifier.",
		inputSchema: z.object({
			websiteId: z.string().describe("Website ID from list_websites"),
			query: z
				.string()
				.min(1)
				.describe("Search query (matches name, slug, URL, or external ID)"),
		}),
		resolveWebsite: true,
		rateLimit: { limit: 60, windowSec: 60 },
	},
	async (input, ctx) => {
		const orgId = await getOrganizationId(input.websiteId);
		if (orgId instanceof Error) {
			throw new McpToolError("not_found", orgId.message);
		}
		const allLinks = (await callRPCProcedure(
			"links",
			"list",
			{ organizationId: orgId },
			buildRpcContext(ctx)
		)) as LinkRow[];
		const queryLower = input.query.toLowerCase();
		const matches = allLinks.filter(
			(link) =>
				link.name.toLowerCase().includes(queryLower) ||
				link.slug.toLowerCase().includes(queryLower) ||
				link.targetUrl.toLowerCase().includes(queryLower) ||
				link.externalId?.toLowerCase().includes(queryLower)
		);
		return {
			links: matches.map((link) => ({
				id: link.id,
				name: link.name,
				slug: link.slug,
				targetUrl: link.targetUrl,
				externalId: link.externalId,
			})),
			count: matches.length,
		};
	}
);

// ---------------------------------------------------------------------------
// search_memory / save_memory (optional)
// ---------------------------------------------------------------------------

const searchMemoryTool = defineMcpTool(
	{
		name: "search_memory",
		description:
			"Search saved notes from prior conversations. Use to recall preferences or earlier findings before re-asking the user.",
		inputSchema: z.object({
			query: z
				.string()
				.min(1)
				.describe(
					"What to search for (e.g. 'pricing page performance', 'past traffic issues')"
				),
			limit: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.describe("Max memories to return (default 5)"),
		}),
		rateLimit: { limit: 30, windowSec: 60 },
	},
	async (input, ctx) => {
		const apiKeyId = ctx.apiKey ? (ctx.apiKey as { id: string }).id : null;
		const results = await searchMemories(input.query, ctx.userId, apiKeyId, {
			limit: input.limit ?? 5,
			threshold: 0.4,
		});
		if (results.length === 0) {
			return { found: false, message: "No relevant memories found." };
		}
		return {
			found: true,
			memories: results.map((r) => ({
				content: r.memory,
				relevance: Math.round(r.similarity * 100),
			})),
		};
	}
);

const saveMemoryTool = defineMcpTool(
	{
		name: "save_memory",
		description:
			"Persist a short insight, preference, or finding for future conversations. Use after a confirmed answer worth remembering.",
		inputSchema: z.object({
			content: z
				.string()
				.min(1)
				.max(2000)
				.describe(
					"The insight to save (e.g. 'User focuses on /pricing bounce rate')"
				),
			category: z
				.enum(["preference", "insight", "pattern", "alert", "context"])
				.optional()
				.describe("Category (default: insight)"),
		}),
		rateLimit: { limit: 30, windowSec: 60 },
	},
	(input, ctx) => {
		const apiKeyId = ctx.apiKey ? (ctx.apiKey as { id: string }).id : null;
		storeMemory(
			[{ role: "assistant", content: input.content }],
			ctx.userId,
			apiKeyId,
			{ category: input.category ?? "insight" }
		);
		return { saved: true };
	}
);

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CORE_TOOL_FACTORIES: McpToolFactory[] = [
	askTool,
	listWebsitesTool,
	getDataTool,
	getSchemaTool,
	capabilitiesTool,
	listFunnelsTool,
	getFunnelAnalyticsTool,
	listGoalsTool,
	getGoalAnalyticsTool,
	listLinksTool,
	searchLinksTool,
	...INSIGHT_TOOL_FACTORIES,
];

export function createMcpTools(ctx: McpRequestContext): RegisteredMcpTool[] {
	const factories = [...CORE_TOOL_FACTORIES];
	if (isMemoryEnabled()) {
		factories.push(searchMemoryTool, saveMemoryTool);
	}
	return factories.map((factory) => factory(ctx));
}
