import { Analytics } from "../../types/tables";
import type { CustomSqlFn, SimpleQueryConfig } from "../types";

const VITALS_SESSION_DIMENSIONS_CTE = `
	session_dimensions AS (
		SELECT
			session_id,
			client_id,
			argMinIf(browser_name, time, ifNull(browser_name, '') != '') as browser_name,
			argMinIf(country, time, ifNull(country, '') != '') as country,
			argMinIf(region, time, ifNull(region, '') != '') as region,
			argMinIf(city, time, ifNull(city, '') != '') as city
		FROM ${Analytics.events}
		WHERE
			client_id = {websiteId:String}
			AND time >= toDateTime({startDate:String})
			AND time <= toDateTime(concat({endDate:String}, ' 23:59:59'))
			AND session_id != ''
			AND event_name = 'screen_view'
		GROUP BY session_id, client_id
	)
`;

const VITALS_P50_METRICS = `
	COUNT(DISTINCT wv.anonymous_id) as visitors,
	quantileIf(0.50)(wv.metric_value, wv.metric_name = 'LCP' AND wv.metric_value > 0) as p50_lcp,
	quantileIf(0.50)(wv.metric_value, wv.metric_name = 'FCP' AND wv.metric_value > 0) as p50_fcp,
	quantileIf(0.50)(wv.metric_value, wv.metric_name = 'CLS') as p50_cls,
	quantileIf(0.50)(wv.metric_value, wv.metric_name = 'INP' AND wv.metric_value > 0) as p50_inp,
	quantileIf(0.50)(wv.metric_value, wv.metric_name = 'TTFB' AND wv.metric_value > 0) as p50_ttfb,
	COUNT(*) as samples
`;

interface VitalsByDimensionConfig {
	defaultLimit: number;
	extraWhere: string;
	groupBy: string;
	metrics?: string;
	selectName: string;
}

function vitalsByDimension(config: VitalsByDimensionConfig): CustomSqlFn {
	const metrics = config.metrics ?? VITALS_P50_METRICS;
	return ({
		websiteId,
		startDate,
		endDate,
		filterConditions,
		filterParams,
		limit,
	}) => {
		const effectiveLimit = limit ?? config.defaultLimit;
		const filterClause = filterConditions?.length
			? `AND ${filterConditions.join(" AND ")}`
			: "";
		return {
			sql: `
				WITH ${VITALS_SESSION_DIMENSIONS_CTE}
				SELECT
					${config.selectName},
					${metrics}
				FROM ${Analytics.web_vitals_spans} wv
				INNER JOIN session_dimensions sd ON wv.session_id = sd.session_id AND wv.client_id = sd.client_id
				WHERE
					wv.client_id = {websiteId:String}
					AND wv.timestamp >= toDateTime({startDate:String})
					AND wv.timestamp <= toDateTime(concat({endDate:String}, ' 23:59:59'))
					AND ${config.extraWhere}
					${filterClause}
				GROUP BY ${config.groupBy}
				ORDER BY samples DESC
				LIMIT {limit:UInt32}
			`,
			params: {
				websiteId,
				startDate,
				endDate,
				limit: effectiveLimit,
				...filterParams,
			},
		};
	};
}

const VITALS_PAGE_METRICS = `
	wv.metric_name as metric_name,
	quantileTDigest(0.50)(wv.metric_value) as p50,
	quantileTDigest(0.75)(wv.metric_value) as p75,
	quantileTDigest(0.90)(wv.metric_value) as p90,
	quantileTDigest(0.95)(wv.metric_value) as p95,
	quantileTDigest(0.99)(wv.metric_value) as p99,
	count() as samples
`;

export const VitalsBuilders: Record<string, SimpleQueryConfig> = {
	vitals_overview: {
		customSql: (ctx) => {
			const { websiteId, startDate, endDate } = ctx;
			return {
				sql: `
				SELECT 
					metric_name,
					quantileTDigest(0.50)(metric_value) as p50,
					quantileTDigest(0.75)(metric_value) as p75,
					quantileTDigest(0.90)(metric_value) as p90,
					quantileTDigest(0.95)(metric_value) as p95,
					quantileTDigest(0.99)(metric_value) as p99,
					avg(metric_value) as avg_value,
					count() as samples
				FROM ${Analytics.web_vitals_spans}
				WHERE 
					client_id = {websiteId:String}
					AND timestamp >= toDateTime({startDate:String})
					AND timestamp <= toDateTime(concat({endDate:String}, ' 23:59:59'))
				GROUP BY metric_name
				ORDER BY metric_name
			`,
				params: { websiteId, startDate, endDate },
			};
		},
		timeField: "timestamp",
		customizable: false,
	},

	vitals_time_series: {
		customSql: (ctx) => {
			const { websiteId, startDate, endDate } = ctx;
			return {
				sql: `
				SELECT 
					toDate(timestamp) as date,
					metric_name,
					quantileTDigest(0.50)(metric_value) as p50,
					quantileTDigest(0.75)(metric_value) as p75,
					quantileTDigest(0.90)(metric_value) as p90,
					quantileTDigest(0.95)(metric_value) as p95,
					quantileTDigest(0.99)(metric_value) as p99,
					count() as samples
				FROM ${Analytics.web_vitals_spans}
				WHERE 
					client_id = {websiteId:String}
					AND timestamp >= toDateTime({startDate:String})
					AND timestamp <= toDateTime(concat({endDate:String}, ' 23:59:59'))
				GROUP BY date, metric_name
				ORDER BY date ASC, metric_name
			`,
				params: { websiteId, startDate, endDate },
			};
		},
		timeField: "timestamp",
		customizable: false,
	},

	vitals_by_page: {
		customSql: vitalsByDimension({
			selectName: `decodeURLComponent(
				CASE WHEN trimRight(path(wv.path), '/') = ''
				THEN '/'
				ELSE trimRight(path(wv.path), '/')
				END
			) as page`,
			metrics: VITALS_PAGE_METRICS,
			groupBy: "page, metric_name",
			extraWhere: "wv.path != ''",
			defaultLimit: 50,
		}),
		timeField: "timestamp",
		customizable: true,
	},

	vitals_by_country: {
		customSql: vitalsByDimension({
			selectName: "sd.country as name",
			groupBy: "sd.country",
			extraWhere: "ifNull(sd.country, '') != ''",
			defaultLimit: 100,
		}),
		timeField: "timestamp",
		customizable: true,
		plugins: { normalizeGeo: true, deduplicateGeo: true },
	},

	vitals_by_browser: {
		customSql: vitalsByDimension({
			selectName: "sd.browser_name as name",
			groupBy: "sd.browser_name",
			extraWhere: "ifNull(sd.browser_name, '') != ''",
			defaultLimit: 100,
		}),
		timeField: "timestamp",
		customizable: true,
	},

	vitals_by_region: {
		customSql: vitalsByDimension({
			selectName:
				"CONCAT(ifNull(sd.region, ''), ', ', ifNull(sd.country, '')) as name",
			groupBy: "sd.region, sd.country",
			extraWhere: "ifNull(sd.region, '') != ''",
			defaultLimit: 100,
		}),
		timeField: "timestamp",
		customizable: true,
		plugins: { normalizeGeo: true, deduplicateGeo: true },
	},

	vitals_by_city: {
		customSql: vitalsByDimension({
			selectName:
				"CONCAT(ifNull(sd.city, ''), ', ', ifNull(sd.country, '')) as name",
			groupBy: "sd.city, sd.country",
			extraWhere: "ifNull(sd.city, '') != ''",
			defaultLimit: 100,
		}),
		timeField: "timestamp",
		customizable: true,
		plugins: { normalizeGeo: true, deduplicateGeo: true },
	},

	performance_overview: {
		customSql: (ctx) => {
			const { websiteId, startDate, endDate } = ctx;
			return {
				sql: `
				SELECT 
					AVG(CASE WHEN load_time > 0 THEN load_time ELSE NULL END) as avg_load_time,
					AVG(CASE WHEN dom_ready_time > 0 THEN dom_ready_time ELSE NULL END) as avg_dom_ready_time,
					AVG(CASE WHEN render_time > 0 THEN render_time ELSE NULL END) as avg_render_time
				FROM ${Analytics.events}
				WHERE 
					client_id = {websiteId:String}
					AND event_name = 'screen_view'
					AND time >= toDateTime({startDate:String})
					AND time <= toDateTime(concat({endDate:String}, ' 23:59:59'))
					AND load_time > 0
			`,
				params: { websiteId, startDate, endDate },
			};
		},
		timeField: "time",
		customizable: false,
	},
};
