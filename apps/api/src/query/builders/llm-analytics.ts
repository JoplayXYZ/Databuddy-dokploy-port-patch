import type { Filter, SimpleQueryConfig, TimeUnit } from "../types";

const LLM_TABLE = "observability.ai_call_spans";
const TIME_FIELD = "timestamp";
const LLM_ALLOWED_FILTERS = [
	"provider",
	"model",
	"type",
	"finish_reason",
	"error_name",
	"http_status",
	"trace_id",
];

const buildTimeBucket = (granularity?: TimeUnit, timezone?: string) => {
	const tz = timezone || "UTC";
	const isHourly = granularity === "hour" || granularity === "hourly";
	const bucketExpr = isHourly
		? `formatDateTime(toStartOfHour(toTimeZone(${TIME_FIELD}, {timezone:String})), '%Y-%m-%d %H:00:00')`
		: `toDate(toTimeZone(${TIME_FIELD}, {timezone:String}))`;

	return {
		bucketExpr,
		params: { timezone: tz },
	};
};

const buildFilterClause = (filterConditions?: string[]) =>
	filterConditions?.length ? `AND ${filterConditions.join(" AND ")}` : "";

// owner_id is the org or user ID that owns this data (from API key)
const baseWhereClause = `
  owner_id = {ownerId:String}
  AND ${TIME_FIELD} >= toDateTime({startDate:String})
  AND ${TIME_FIELD} <= toDateTime(concat({endDate:String}, ' 23:59:59'))
`;

export const LLMAnalyticsBuilders: Record<string, SimpleQueryConfig> = {
	llm_overview_kpis: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					count() AS total_calls,
					sum(total_token_cost_usd) AS total_cost,
					sum(total_tokens) AS total_tokens,
					sum(input_tokens) AS total_input_tokens,
					sum(output_tokens) AS total_output_tokens,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					countIf(error_name IS NOT NULL) AS error_count,
					round(countIf(error_name IS NOT NULL) / nullIf(count(), 0), 4) AS error_rate,
					round(sumIf(cached_input_tokens, cached_input_tokens > 0) / nullIf(sum(input_tokens), 0), 4) AS cache_hit_rate,
					round(countIf(tool_call_count > 0) / nullIf(count(), 0), 4) AS tool_use_rate,
					round(countIf(web_search_count > 0) / nullIf(count(), 0), 4) AS web_search_rate
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Overview KPIs",
			description: "High-level cost, token, latency, and reliability metrics.",
			category: "LLM Analytics",
			tags: ["llm", "kpi", "overview"],
			output_fields: [],
			default_visualization: "metric",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					count() AS total_calls,
					sum(total_token_cost_usd) AS total_cost,
					sum(total_tokens) AS total_tokens,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Time Series",
			description: "Calls, cost, tokens, and latency over time.",
			category: "LLM Analytics",
			tags: ["llm", "timeseries"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_provider_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 12;

			return {
				sql: `
				SELECT
					provider AS name,
					provider,
					count() AS calls,
					sum(total_token_cost_usd) AS total_cost,
					sum(total_tokens) AS total_tokens,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					round(countIf(error_name IS NOT NULL) / nullIf(count(), 0), 4) AS error_rate
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY provider
				ORDER BY total_cost DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Provider Breakdown",
			description: "Cost, tokens, and latency by provider.",
			category: "LLM Analytics",
			tags: ["llm", "provider"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_model_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 20;

			return {
				sql: `
				SELECT
					model AS name,
					model,
					provider,
					count() AS calls,
					sum(total_token_cost_usd) AS total_cost,
					sum(total_tokens) AS total_tokens,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					round(countIf(error_name IS NOT NULL) / nullIf(count(), 0), 4) AS error_rate
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY model, provider
				ORDER BY total_cost DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Model Breakdown",
			description: "Cost, tokens, and latency by model.",
			category: "LLM Analytics",
			tags: ["llm", "model"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_finish_reason_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 12;

			return {
				sql: `
				SELECT
					finish_reason AS name,
					finish_reason,
					count() AS calls
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					AND finish_reason IS NOT NULL
					${filterClause}
				GROUP BY finish_reason
				ORDER BY calls DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Finish Reasons",
			description: "Distribution of finish reasons.",
			category: "LLM Analytics",
			tags: ["llm", "finish_reason"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_error_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 15;

			return {
				sql: `
				SELECT
					error_name AS name,
					error_name,
					any(error_message) AS sample_message,
					count() AS error_count
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					AND error_name IS NOT NULL
					${filterClause}
				GROUP BY error_name
				ORDER BY error_count DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Errors",
			description: "Top error names and samples.",
			category: "LLM Analytics",
			tags: ["llm", "errors"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_cost_by_provider_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					provider,
					sum(total_token_cost_usd) AS total_cost
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date, provider
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Cost by Provider",
			description: "Cost over time by provider.",
			category: "LLM Analytics",
			tags: ["llm", "cost", "provider"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_cost_by_model_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					model,
					sum(total_token_cost_usd) AS total_cost
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date, model
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Cost by Model",
			description: "Cost over time by model.",
			category: "LLM Analytics",
			tags: ["llm", "cost", "model"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_latency_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					quantile(0.95)(duration_ms) AS p95_duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Latency Time Series",
			description: "Latency percentiles over time.",
			category: "LLM Analytics",
			tags: ["llm", "latency"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_latency_by_model: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 20;

			return {
				sql: `
				SELECT
					model AS name,
					model,
					provider,
					count() AS calls,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.50)(duration_ms) AS p50_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					quantile(0.95)(duration_ms) AS p95_duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY model, provider
				ORDER BY p75_duration_ms DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Latency by Model",
			description: "Latency percentiles by model.",
			category: "LLM Analytics",
			tags: ["llm", "latency", "model"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_latency_by_provider: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 12;

			return {
				sql: `
				SELECT
					provider AS name,
					provider,
					count() AS calls,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.50)(duration_ms) AS p50_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms,
					quantile(0.95)(duration_ms) AS p95_duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY provider
				ORDER BY p75_duration_ms DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Latency by Provider",
			description: "Latency percentiles by provider.",
			category: "LLM Analytics",
			tags: ["llm", "latency", "provider"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_slowest_calls: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 50;

			return {
				sql: `
				SELECT
					${TIME_FIELD} AS timestamp,
					provider,
					model,
					total_tokens,
					duration_ms,
					finish_reason,
					error_name,
					trace_id
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				ORDER BY duration_ms DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "Slowest LLM Calls",
			description: "Longest duration calls.",
			category: "LLM Analytics",
			tags: ["llm", "latency", "calls"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_error_rate_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					countIf(error_name IS NOT NULL) AS error_count,
					round(countIf(error_name IS NOT NULL) / nullIf(count(), 0), 4) AS error_rate
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Error Rate Time Series",
			description: "Error rate over time.",
			category: "LLM Analytics",
			tags: ["llm", "errors", "timeseries"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_http_status_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 12;

			return {
				sql: `
				SELECT
					toString(http_status) AS name,
					http_status,
					count() AS calls
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					AND http_status IS NOT NULL
					${filterClause}
				GROUP BY http_status
				ORDER BY calls DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM HTTP Status",
			description: "HTTP status distribution.",
			category: "LLM Analytics",
			tags: ["llm", "http"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_recent_errors: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 50;

			return {
				sql: `
				SELECT
					${TIME_FIELD} AS timestamp,
					error_name,
					error_message,
					error_stack,
					model,
					provider,
					http_status,
					duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					AND error_name IS NOT NULL
					${filterClause}
				ORDER BY ${TIME_FIELD} DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Recent Errors",
			description: "Most recent error calls with stack traces.",
			category: "LLM Analytics",
			tags: ["llm", "errors"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_tool_use_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const { bucketExpr, params } = buildTimeBucket(granularity, timezone);
			const filterClause = buildFilterClause(filterConditions);

			return {
				sql: `
				SELECT
					${bucketExpr} AS date,
					round(countIf(tool_call_count > 0) / nullIf(count(), 0), 4) AS tool_use_rate,
					avg(tool_call_count) AS avg_tool_calls,
					avg(tool_result_count) AS avg_tool_results
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				GROUP BY date
				ORDER BY date ASC
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...params,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Tool Use Time Series",
			description: "Tool usage rate over time.",
			category: "LLM Analytics",
			tags: ["llm", "tools", "timeseries"],
			output_fields: [],
			default_visualization: "timeseries",
			supports_granularity: ["day", "hour"],
			version: "1.0",
		},
	},
	llm_tool_name_breakdown: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 20;

			return {
				sql: `
				SELECT
					tool_name AS name,
					tool_name,
					count() AS calls
				FROM (
					SELECT arrayJoin(tool_call_names) AS tool_name
					FROM ${LLM_TABLE}
					WHERE ${baseWhereClause}
						${filterClause}
				)
				GROUP BY tool_name
				ORDER BY calls DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Tool Names",
			description: "Top tool names used in calls.",
			category: "LLM Analytics",
			tags: ["llm", "tools"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_trace_summary: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 200;

			return {
				sql: `
				SELECT
					trace_id AS name,
					trace_id,
					'' AS user_id,
					'' AS website_id,
					count() AS calls,
					sum(total_tokens) AS total_tokens,
					sum(total_token_cost_usd) AS total_cost,
					countIf(error_name IS NOT NULL) AS errors,
					avg(duration_ms) AS avg_duration_ms,
					quantile(0.75)(duration_ms) AS p75_duration_ms
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					AND trace_id IS NOT NULL
					AND trace_id != ''
					${filterClause}
				GROUP BY trace_id
				ORDER BY total_cost DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Trace Summary",
			description: "Trace-level aggregate metrics.",
			category: "LLM Analytics",
			tags: ["llm", "traces"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
	llm_recent_calls: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			_filters?: Filter[],
			_granularity?: TimeUnit,
			limit?: number,
			_offset?: number,
			_timezone?: string,
			filterConditions?: string[],
			filterParams?: Record<string, Filter["value"]>
		) => {
			const filterClause = buildFilterClause(filterConditions);
			const appliedLimit = limit ?? 50;

			return {
				sql: `
				SELECT
					${TIME_FIELD} AS timestamp,
					trace_id,
					'' AS user_id,
					provider,
					model,
					total_tokens,
					total_token_cost_usd,
					duration_ms,
					finish_reason,
					error_name
				FROM ${LLM_TABLE}
				WHERE ${baseWhereClause}
					${filterClause}
				ORDER BY ${TIME_FIELD} DESC
				LIMIT ${appliedLimit}
				`,
				params: {
					ownerId: websiteId,
					startDate,
					endDate,
					...filterParams,
				},
			};
		},
		customizable: true,
		allowedFilters: LLM_ALLOWED_FILTERS,
		meta: {
			title: "LLM Recent Calls",
			description: "Most recent LLM calls.",
			category: "LLM Analytics",
			tags: ["llm", "calls"],
			output_fields: [],
			default_visualization: "table",
			supports_granularity: ["day"],
			version: "1.0",
		},
	},
};
