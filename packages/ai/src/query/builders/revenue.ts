import { Analytics } from "../../types/tables";
import type { Filter, SimpleQueryConfig, TimeUnit } from "../types";

const REVENUE_FILTER_COLUMNS: Record<string, string> = {
	country: "country",
	region: "region",
	city: "city",
	browser_name: "browser_name",
	device_type: "device_type",
	os_name: "os_name",
	utm_source: "utm_source",
	utm_medium: "utm_medium",
	utm_campaign: "utm_campaign",
	referrer: "referrer_domain",
	path: "entry_path",
	provider: "provider",
	type: "type",
};

function escapeRevenueLikeValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function buildRevenueFilterConditions(filters?: Filter[]): {
	conditions: string[];
	params: Record<string, Filter["value"]>;
} {
	if (!filters?.length) {
		return { conditions: [], params: {} };
	}

	const params: Record<string, Filter["value"]> = {};
	const conditions: string[] = [];

	filters.forEach((filter, i) => {
		if (!filter || filter.having) {
			return;
		}
		const column = REVENUE_FILTER_COLUMNS[filter.field];
		if (!column) {
			return;
		}

		const key = `rf${i}`;
		const op = filter.op;

		if (op === "in" || op === "not_in") {
			const values = Array.isArray(filter.value)
				? filter.value
				: [filter.value];
			if (values.length === 0) {
				return;
			}
			params[key] = values.map((v) => String(v));
			conditions.push(
				`${column} ${op === "in" ? "IN" : "NOT IN"} {${key}:Array(String)}`
			);
			return;
		}

		if (op === "contains" || op === "not_contains") {
			params[key] = `%${escapeRevenueLikeValue(String(filter.value))}%`;
			conditions.push(
				`${column} ${op === "contains" ? "LIKE" : "NOT LIKE"} {${key}:String}`
			);
			return;
		}

		if (op === "starts_with") {
			params[key] = `${escapeRevenueLikeValue(String(filter.value))}%`;
			conditions.push(`${column} LIKE {${key}:String}`);
			return;
		}

		params[key] = String(filter.value);
		conditions.push(`${column} ${op === "ne" ? "!=" : "="} {${key}:String}`);
	});

	return { conditions, params };
}

function buildRevenueWhereClause(
	filters?: Filter[],
	extraConditions: string[] = []
): { whereClause: string; params: Record<string, Filter["value"]> } {
	const { conditions, params } = buildRevenueFilterConditions(filters);
	const all = [...extraConditions, ...conditions];
	return {
		whereClause: all.length ? ` WHERE ${all.join(" AND ")}` : "",
		params,
	};
}

function isOrgScope(filterParams?: Record<string, Filter["value"]>): boolean {
	return filterParams?.__orgLevel === "true";
}

function buildAttributionCte(
	filterParams?: Record<string, Filter["value"]>
): string {
	const orgScope = isOrgScope(filterParams);
	const directScope = orgScope
		? "(owner_id = {organizationId:String} OR website_id IN {websiteIds:Array(String)})"
		: "(owner_id = {websiteId:String} OR website_id = {websiteId:String})";
	const aliasedScope = orgScope
		? "(r.owner_id = {organizationId:String} OR r.website_id IN {websiteIds:Array(String)})"
		: "(r.owner_id = {websiteId:String} OR r.website_id = {websiteId:String})";

	return `
		pi_dedup AS (
			SELECT amount, toUnixTimestamp(created) as ts
			FROM ${Analytics.revenue}
			WHERE
				${directScope}
				AND created >= toDateTime({startDate:String})
				AND created <= toDateTime(concat({endDate:String}, ' 23:59:59'))
				AND startsWith(transaction_id, 'pi_')
				AND amount > 0
		),
		revenue_base AS (
			SELECT
				r.transaction_id,
				r.amount,
				r.type,
				r.anonymous_id as r_anonymous_id,
				r.session_id as r_session_id,
				r.customer_id as r_customer_id,
				r.product_id,
				r.product_name,
				r.provider,
				r.created
			FROM ${Analytics.revenue} r
			WHERE
				${aliasedScope}
				AND r.created >= toDateTime({startDate:String})
				AND r.created <= toDateTime(concat({endDate:String}, ' 23:59:59'))
				AND r.type != 'subscription_event'
				AND NOT (
					startsWith(r.transaction_id, 'in_')
					AND (
						(r.amount, toUnixTimestamp(r.created)) IN (SELECT amount, ts FROM pi_dedup)
						OR (r.amount, toUnixTimestamp(r.created) + 1) IN (SELECT amount, ts FROM pi_dedup)
						OR (r.amount, toUnixTimestamp(r.created) - 1) IN (SELECT amount, ts FROM pi_dedup)
					)
				)
		),
		active_customers AS (
			SELECT DISTINCT r_customer_id as customer_id
			FROM revenue_base
			WHERE r_customer_id IS NOT NULL AND r_customer_id != ''
		),
		customer_session_map AS (
			SELECT
				r.customer_id as customer_id,
				argMin(r.session_id, r.created) as mapped_session_id
			FROM ${Analytics.revenue} r
			INNER JOIN active_customers ac ON r.customer_id = ac.customer_id
			WHERE ${aliasedScope}
				AND r.customer_id IS NOT NULL AND r.customer_id != ''
				AND r.session_id IS NOT NULL AND r.session_id != ''
			GROUP BY r.customer_id
		),
		first_touch_by_session AS (
			SELECT
				session_id,
				argMin(country, time) as first_country,
				argMin(region, time) as first_region,
				argMin(city, time) as first_city,
				argMin(browser_name, time) as first_browser,
				argMin(device_type, time) as first_device,
				argMin(os_name, time) as first_os,
				argMin(domain(referrer), time) as first_referrer,
				argMin(utm_source, time) as first_utm_source,
				argMin(utm_medium, time) as first_utm_medium,
				argMin(utm_campaign, time) as first_utm_campaign,
				argMin(path, time) as first_path
			FROM ${Analytics.events}
			WHERE client_id = {websiteId:String}
				AND session_id != ''
				AND time >= toDateTime({startDate:String}) - INTERVAL 90 DAY
				AND time <= toDateTime(concat({endDate:String}, ' 23:59:59'))
			GROUP BY session_id
		),
		revenue_attributed AS (
			SELECT
				rb.transaction_id,
				rb.amount,
				rb.type,
				rb.r_anonymous_id,
				rb.r_session_id,
				rb.r_customer_id,
				rb.product_id,
				rb.product_name,
				rb.provider,
				rb.created,
				CASE
					WHEN ft_direct.session_id != '' THEN 1
					WHEN ft_customer.session_id != '' THEN 1
					ELSE 0
				END as is_attributed,
				coalesce(ft_direct.first_country, ft_customer.first_country) as country,
				coalesce(ft_direct.first_region, ft_customer.first_region) as region,
				coalesce(ft_direct.first_city, ft_customer.first_city) as city,
				coalesce(ft_direct.first_browser, ft_customer.first_browser) as browser_name,
				coalesce(ft_direct.first_device, ft_customer.first_device) as device_type,
				coalesce(ft_direct.first_os, ft_customer.first_os) as os_name,
				coalesce(ft_direct.first_referrer, ft_customer.first_referrer) as referrer_domain,
				coalesce(ft_direct.first_utm_source, ft_customer.first_utm_source) as utm_source,
				coalesce(ft_direct.first_utm_medium, ft_customer.first_utm_medium) as utm_medium,
				coalesce(ft_direct.first_utm_campaign, ft_customer.first_utm_campaign) as utm_campaign,
				coalesce(ft_direct.first_path, ft_customer.first_path) as entry_path
			FROM revenue_base rb
			LEFT JOIN first_touch_by_session ft_direct
				ON rb.r_session_id = ft_direct.session_id
				AND rb.r_session_id IS NOT NULL
				AND rb.r_session_id != ''
			LEFT JOIN customer_session_map csm
				ON rb.r_customer_id = csm.customer_id
				AND rb.r_customer_id IS NOT NULL
				AND rb.r_customer_id != ''
				AND ft_direct.session_id = ''
			LEFT JOIN first_touch_by_session ft_customer
				ON csm.mapped_session_id = ft_customer.session_id
				AND csm.mapped_session_id IS NOT NULL
				AND csm.mapped_session_id != ''
		)
	`;
}

function buildScopeParams(
	projectId: string,
	filterParams?: Record<string, Filter["value"]>
): Record<string, Filter["value"]> {
	return isOrgScope(filterParams) ? { organizationId: projectId } : {};
}

export const RevenueBuilders: Record<string, SimpleQueryConfig> = {
	revenue_overview: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						sumIf(amount, type != 'refund') as total_revenue,
						countIf(type != 'refund') as total_transactions,
						sumIf(amount, type = 'refund') as refund_amount,
						countIf(type = 'refund') as refund_count,
						sumIf(amount, type = 'subscription') as subscription_revenue,
						countIf(type = 'subscription') as subscription_count,
						sumIf(amount, type = 'sale') as sale_revenue,
						countIf(type = 'sale') as sale_count,
						uniq(r_customer_id) as unique_customers,
						countIf(is_attributed = 1 AND type != 'refund') as attributed_transactions,
						sumIf(amount, is_attributed = 1 AND type != 'refund') as attributed_revenue
					FROM revenue_attributed${whereClause}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: false,
	},

	revenue_time_series: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						toDate(created) as date,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						sumIf(amount, type = 'refund') as refund_amount,
						countIf(type = 'refund') as refund_count,
						sumIf(amount, is_attributed = 1 AND type != 'refund') as attributed_revenue,
						countIf(is_attributed = 1 AND type != 'refund') as attributed_transactions
					FROM revenue_attributed${whereClause}
					GROUP BY date
					ORDER BY date ASC
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: false,
	},

	revenue_by_provider: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						provider as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY provider
					ORDER BY revenue DESC
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: false,
	},

	revenue_by_product: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 50;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						coalesce(product_name, 'Unknown') as name,
						product_id,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY product_name, product_id
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_attribution_overview: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE WHEN is_attributed = 1 THEN 'Attributed' ELSE 'Unattributed' END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY is_attributed
					ORDER BY revenue DESC
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: false,
	},

	revenue_by_country: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN country = '' OR country IS NULL THEN 'Unknown'
							ELSE country
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
		plugins: {
			deduplicateGeo: true,
			normalizeGeo: true,
		},
	},

	revenue_by_region: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN region = '' OR region IS NULL THEN 'Unknown'
							ELSE region
						END as name,
						country,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name, country
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
		plugins: {
			normalizeGeo: true,
		},
	},

	revenue_by_city: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN city = '' OR city IS NULL THEN 'Unknown'
							ELSE city
						END as name,
						country,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name, country
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
		plugins: {
			normalizeGeo: true,
		},
	},

	revenue_by_browser: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 10;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN browser_name = '' OR browser_name IS NULL THEN 'Unknown'
							ELSE browser_name
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_device: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 10;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN device_type = '' OR device_type IS NULL THEN 'Unknown'
							ELSE device_type
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_os: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 10;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN os_name = '' OR os_name IS NULL THEN 'Unknown'
							ELSE os_name
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_referrer: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)},
					referrer_agg AS (
						SELECT
							CASE
								WHEN is_attributed = 0 THEN 'Unattributed'
								WHEN referrer_domain = '' OR referrer_domain IS NULL THEN 'Direct'
								ELSE referrer_domain
							END as referrer_name,
							amount,
							type,
							r_customer_id
						FROM revenue_attributed${whereClause}
					)
					SELECT
						referrer_name as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM referrer_agg
					GROUP BY referrer_name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_utm_source: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN utm_source = '' OR utm_source IS NULL THEN 'None'
							ELSE utm_source
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_utm_medium: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN utm_medium = '' OR utm_medium IS NULL THEN 'None'
							ELSE utm_medium
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_utm_campaign: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN utm_campaign = '' OR utm_campaign IS NULL THEN 'None'
							ELSE utm_campaign
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	revenue_by_entry_page: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 20;
			const { whereClause, params: whereParams } =
				buildRevenueWhereClause(filters);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						CASE
							WHEN is_attributed = 0 THEN 'Unattributed'
							WHEN entry_path = '' OR entry_path IS NULL THEN 'Unknown'
							ELSE entry_path
						END as name,
						sumIf(amount, type != 'refund') as revenue,
						countIf(type != 'refund') as transactions,
						uniq(r_customer_id) as customers,
						ROUND((sumIf(amount, type != 'refund') / nullIf(SUM(sumIf(amount, type != 'refund')) OVER(), 0)) * 100, 2) as percentage
					FROM revenue_attributed${whereClause}
					GROUP BY name
					ORDER BY revenue DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
	},

	recent_transactions: {
		customSql: (
			websiteId: string,
			startDate: string,
			endDate: string,
			filters?: Filter[],
			_granularity?: TimeUnit,
			_limit?: number,
			_offset?: number,
			_timezone?: string,
			_filterConditions?: string[],
			customSqlParams?: Record<string, Filter["value"]>
		) => {
			const limit = _limit ?? 50;
			const { whereClause, params: whereParams } = buildRevenueWhereClause(
				filters,
				["type != 'refund'"]
			);
			return {
				sql: `
					WITH ${buildAttributionCte(customSqlParams)}
					SELECT
						transaction_id,
						provider,
						type,
						amount,
						r_anonymous_id as anonymous_id,
						product_name,
						created,
						is_attributed,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(country, ''), 'Unknown') END as country,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(browser_name, ''), 'Unknown') END as browser_name,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(device_type, ''), 'Unknown') END as device_type,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(referrer_domain, ''), 'Direct') END as referrer,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(utm_source, ''), 'None') END as utm_source,
						CASE WHEN is_attributed = 0 THEN 'Unattributed' ELSE coalesce(nullIf(utm_campaign, ''), 'None') END as utm_campaign
					FROM revenue_attributed${whereClause}
					ORDER BY created DESC
					LIMIT {limit:UInt32}
				`,
				params: {
					websiteId,
					startDate,
					endDate,
					limit,
					...buildScopeParams(websiteId, customSqlParams),
					...whereParams,
				},
			};
		},
		timeField: "created",
		customizable: true,
		plugins: {
			normalizeGeo: true,
		},
	},
};
