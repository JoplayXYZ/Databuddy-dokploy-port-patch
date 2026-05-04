import { describe, expect, it } from "bun:test";
import { QueryBuilders } from "./builders";
import { SimpleQueryBuilder } from "./simple-builder";
import type { Filter, QueryRequest, SimpleQueryConfig } from "./types";
import { applyPlugins } from "./utils";

function makeRequest(overrides: Partial<QueryRequest> = {}): QueryRequest {
	return {
		projectId: "test-site-id",
		type: "test",
		from: "2026-04-01",
		to: "2026-04-11",
		...overrides,
	};
}

function makeConfig(overrides: Partial<SimpleQueryConfig> = {}): SimpleQueryConfig {
	return {
		table: "analytics.events",
		fields: ["count() as total"],
		groupBy: ["path"],
		orderBy: "total DESC",
		limit: 10,
		...overrides,
	};
}

function compile(
	config: Partial<SimpleQueryConfig> = {},
	request: Partial<QueryRequest> = {},
	domain?: string | null
) {
	return new SimpleQueryBuilder(
		makeConfig(config),
		makeRequest(request),
		domain
	).compile();
}

describe("SimpleQueryBuilder.compile", () => {
	it("produces a valid SELECT with tenant filter and date range", () => {
		const { sql, params } = compile();
		expect(sql).toContain("client_id = {websiteId:String}");
		expect(sql).toContain("FROM analytics.events");
		expect(sql).toContain("GROUP BY path");
		expect(sql).toContain("ORDER BY total DESC");
		expect(sql).toContain("LIMIT 10");
		expect(params.websiteId).toBe("test-site-id");
	});

	it("uses all organization website ids for org-scoped standard queries", () => {
		const { sql, params } = compile(
			{},
			{
				projectId: "org-id",
				organizationWebsiteIds: ["site-a", "site-b"],
			}
		);

		expect(sql).toContain("client_id IN {websiteIds:Array(String)}");
		expect(sql).not.toContain("client_id = {websiteId:String}");
		expect(params.websiteIds).toEqual(["site-a", "site-b"]);
	});

	it("rewrites custom SQL website filters for org scope", () => {
		const { sql, params } = compile(
			{
				customSql: (websiteId, startDate, endDate) => ({
					sql: `
						SELECT count() as total
						FROM analytics.events e
						WHERE e.client_id = {websiteId:String}
							AND e.time >= toDateTime({startDate:String})
							AND e.time <= toDateTime({endDate:String})
					`,
					params: { websiteId, startDate, endDate },
				}),
			},
			{
				projectId: "org-id",
				organizationWebsiteIds: ["site-a", "site-b"],
			}
		);

		expect(sql).toContain("e.client_id IN {websiteIds:Array(String)}");
		expect(sql).not.toContain("e.client_id = {websiteId:String}");
		expect(params.websiteIds).toEqual(["site-a", "site-b"]);
	});

	it("applies eq filter with parameterized value", () => {
		const filters: Filter[] = [{ field: "country", op: "eq", value: "US" }];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("country = {f0:String}");
		expect(params.f0).toBe("US");
	});

	it("applies ne filter", () => {
		const filters: Filter[] = [{ field: "country", op: "ne", value: "US" }];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("country != {f0:String}");
		expect(params.f0).toBe("US");
	});

	it("applies contains filter with LIKE and escaped pattern", () => {
		const filters: Filter[] = [
			{ field: "path", op: "contains", value: "/blog" },
		];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("LIKE {f0:String}");
		expect(params.f0).toBe("%/blog%");
	});

	it("applies not_contains filter", () => {
		const filters: Filter[] = [
			{ field: "path", op: "not_contains", value: "/admin" },
		];
		const { sql } = compile({}, { filters });
		expect(sql).toContain("NOT LIKE {f0:String}");
	});

	it("applies starts_with filter", () => {
		const filters: Filter[] = [
			{ field: "path", op: "starts_with", value: "/docs" },
		];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("LIKE {f0:String}");
		expect(params.f0).toBe("/docs%");
	});

	it("applies in filter with array param", () => {
		const filters: Filter[] = [
			{ field: "country", op: "in", value: ["US", "UK", "DE"] },
		];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("IN {f0:Array(String)}");
		expect(params.f0).toEqual(["US", "UK", "DE"]);
	});

	it("applies not_in filter", () => {
		const filters: Filter[] = [
			{ field: "country", op: "not_in", value: ["CN", "RU"] },
		];
		const { sql } = compile({}, { filters });
		expect(sql).toContain("NOT IN {f0:Array(String)}");
	});

	it("escapes LIKE special characters in contains filter", () => {
		const filters: Filter[] = [
			{ field: "path", op: "contains", value: "100%" },
		];
		const { params } = compile({}, { filters });
		expect(params.f0).toBe("%100\\%%");
	});

	it("escapes underscores in LIKE patterns", () => {
		const filters: Filter[] = [
			{ field: "path", op: "contains", value: "test_page" },
		];
		const { params } = compile({}, { filters });
		expect(params.f0).toBe("%test\\_page%");
	});

	it("escapes backslashes in LIKE patterns", () => {
		const filters: Filter[] = [
			{ field: "path", op: "contains", value: "a\\b" },
		];
		const { params } = compile({}, { filters });
		expect(params.f0).toBe("%a\\\\b%");
	});

	it("handles desktop device_type filter (empty string OR desktop)", () => {
		const filters: Filter[] = [
			{ field: "device_type", op: "eq", value: "desktop" },
		];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain(
			"(device_type = '' OR lower(device_type) = {f0:String})"
		);
		expect(params.f0).toBe("desktop");
	});

	it("handles mobile device_type filter", () => {
		const filters: Filter[] = [
			{ field: "device_type", op: "eq", value: "mobile" },
		];
		const { sql, params } = compile({}, { filters });
		expect(sql).toContain("lower(device_type) = {f0:String}");
		expect(params.f0).toBe("mobile");
	});

	it("throws on disallowed filter field", () => {
		const filters: Filter[] = [
			{ field: "secret_col", op: "eq", value: "x" },
		];
		expect(() =>
			compile({ allowedFilters: ["country"] }, { filters })
		).toThrow("not permitted");
	});

	it("rejects unknown filter fields when allowedFilters is not configured", () => {
		const filters: Filter[] = [
			{ field: "1=1) OR (1", op: "eq", value: "x" },
		];
		expect(() => compile({}, { filters })).toThrow("not permitted");
	});

	it("rejects SQL injection attempts in filter field names", () => {
		const injectionAttempts = [
			"'; DROP TABLE analytics.events; --",
			"country UNION SELECT * FROM system.tables--",
			"1=1",
			"path; DELETE FROM",
		];
		for (const field of injectionAttempts) {
			const filters: Filter[] = [{ field, op: "eq", value: "x" }];
			expect(() => compile({}, { filters })).toThrow("not permitted");
		}
	});

	it("allows globally allowed filters even when allowedFilters is set", () => {
		const filters: Filter[] = [
			{ field: "country", op: "eq", value: "US" },
		];
		expect(() =>
			compile({ allowedFilters: ["custom_field"] }, { filters })
		).not.toThrow();
	});

	it("allows globally allowed filters when allowedFilters is not configured", () => {
		const filters: Filter[] = [
			{ field: "country", op: "eq", value: "US" },
			{ field: "path", op: "contains", value: "/blog" },
			{ field: "referrer", op: "eq", value: "google" },
		];
		expect(() => compile({}, { filters })).not.toThrow();
	});

	it("throws when a required filter is missing", () => {
		expect(() => compile({ requiredFilters: ["session_id"] })).toThrow(
			"Missing required filter: 'session_id'."
		);
	});

	it("allows a configured required filter when present", () => {
		const filters: Filter[] = [
			{ field: "session_id", op: "eq", value: "session-1" },
		];

		const { sql, params } = compile(
			{
				allowedFilters: ["session_id"],
				requiredFilters: ["session_id"],
			},
			{ filters }
		);

		expect(sql).toContain("session_id = {f0:String}");
		expect(params.f0).toBe("session-1");
	});

	it("requires session_id for the session_events builder", () => {
		const config = QueryBuilders.session_events;
		if (!config) {
			throw new Error("session_events builder is missing");
		}

		const builder = new SimpleQueryBuilder(
			config,
			makeRequest({ type: "session_events" })
		);

		expect(() => builder.compile()).toThrow(
			"Missing required filter: 'session_id'."
		);
	});

	it("throws on SQL injection in groupBy", () => {
		expect(() =>
			compile({}, { groupBy: ["path; DROP TABLE analytics.events"] })
		).toThrow("not permitted");
	});

	it("throws on SQL injection in orderBy", () => {
		expect(() =>
			compile({}, { orderBy: "total DESC; DELETE FROM analytics.events" })
		).toThrow("not permitted");
	});

	it("normalizes referrer filter values", () => {
		const filters: Filter[] = [
			{ field: "referrer", op: "eq", value: "google" },
		];
		const { params } = compile({}, { filters });
		expect(params.f0).toBe("https://google.com");
	});

	it("normalizes common referrer aliases for filters", () => {
		const xFilter: Filter[] = [{ field: "referrer", op: "eq", value: "x.com" }];
		const linkedinFilter: Filter[] = [
			{ field: "referrer", op: "eq", value: "linkedin" },
		];

		expect(compile({}, { filters: xFilter }).params.f0).toBe(
			"https://twitter.com"
		);
		expect(compile({}, { filters: linkedinFilter }).params.f0).toBe(
			"https://linkedin.com"
		);
	});

	it("uses custom idField when configured", () => {
		const { sql } = compile({ idField: "owner_id" });
		expect(sql).toContain("owner_id = {websiteId:String}");
		expect(sql).not.toContain("client_id");
	});

	it("skips date filter when skipDateFilter is true", () => {
		const { sql } = compile({ skipDateFilter: true });
		expect(sql).not.toContain("toDateTime({from:String})");
	});

	it("normalizes timestamp bounds for ClickHouse date parsing", () => {
		const { sql, params } = compile(
			{},
			{
				from: "2026-04-27 12:00:00Z",
				to: "2026-04-27 13:28:59Z",
			}
		);

		expect(sql).toContain("parseDateTimeBestEffort({from:String}");
		expect(sql).toContain("parseDateTimeBestEffort({to:String}");
		expect(sql).not.toContain("concat({to:String}, ' 23:59:59')");
		expect(params.from).toBe("2026-04-27 12:00:00");
		expect(params.to).toBe("2026-04-27 13:28:59");
		expect(params.timezone).toBeUndefined();
	});

	it("keeps date-only ranges inclusive through the end of the end date", () => {
		const { sql, params } = compile();

		expect(sql).not.toContain("concat({to:String}, ' 23:59:59')");
		expect(params.from).toBe("2026-04-01");
		expect(params.to).toBe("2026-04-11 23:59:59");
	});

	it("cleans date ranges returned by custom SQL builders", () => {
		const { sql, params } = compile(
			{
				customSql: (_websiteId, startDate, endDate) => ({
					sql: `
						SELECT count() as total
						FROM analytics.events
						WHERE time >= toDateTime({startDate:String})
							AND time <= toDateTime({endDate:String})
					`,
					params: {
						startDate,
						endDate: `${endDate} 23:59:59`,
					},
				}),
			},
			{
				from: "2026-04-27T12:00:00.000Z",
				to: "2026-04-27T13:28:59.000Z",
			}
		);

		expect(sql).toContain("parseDateTimeBestEffort({startDate:String}");
		expect(sql).toContain("parseDateTimeBestEffort({endDate:String}");
		expect(params.startDate).toBe("2026-04-27 12:00:00");
		expect(params.endDate).toBe("2026-04-27 13:28:59");
	});

	it("normalizes session attribution builders with timestamp inputs", () => {
		const config = QueryBuilders.summary_metrics;
		if (!config) {
			throw new Error("summary_metrics builder is missing");
		}

		const builder = new SimpleQueryBuilder(
			config,
			makeRequest({
				type: "summary_metrics",
				from: "2026-04-27 12:00:00Z",
				to: "2026-04-27 13:28:59Z",
			})
		);

		const { sql, params } = builder.compile();

		expect(sql).toContain("session_attribution AS");
		expect(sql).not.toContain("toDateTime({startDate:String})");
		expect(sql).not.toContain("concat({endDate:String}, ' 23:59:59')");
		expect(params.startDate).toBe("2026-04-27 12:00:00");
		expect(params.endDate).toBe("2026-04-27 13:28:59");
	});

	it("normalizes standard session attribution queries", () => {
		const { sql, params } = compile(
			{
				plugins: { sessionAttribution: true },
				fields: ["device_type as name", "count() as total"],
				groupBy: ["device_type"],
			},
			{
				from: "2026-04-27 12:00:00Z",
				to: "2026-04-27 13:28:59Z",
			}
		);

		expect(sql).toContain("session_attribution AS");
		expect(sql).not.toContain("toDateTime({from:String})");
		expect(sql).not.toContain("concat({to:String}, ' 23:59:59')");
		expect(params.from).toBe("2026-04-27 12:00:00");
		expect(params.to).toBe("2026-04-27 13:28:59");
	});

	it("builds traffic sources with direct visits and session attribution", () => {
		const config = QueryBuilders.traffic_sources;
		if (!config) {
			throw new Error("traffic_sources builder is missing");
		}

		const builder = new SimpleQueryBuilder(
			config,
			makeRequest({ type: "traffic_sources" }),
			"example.com"
		);

		const { sql } = builder.compile();

		expect(sql).toContain("session_attribution AS");
		expect(sql).toContain("e.* REPLACE(");
		expect(sql).toContain("WHEN referrer = '' OR referrer IS NULL");
		expect(sql).toContain("domain(referrer) = ''");
		expect(sql).toContain("domain(referrer) = 'example.com'");
		expect(sql).toContain("domain(referrer) LIKE 'x.com%'");
		expect(sql).toContain("https://linkedin.com");
		expect(sql).toContain("as name");
		expect(sql).toContain("as percentage");
		expect(sql).not.toContain("referrer != ''");
	});

	it("canonicalizes and deduplicates parsed traffic source display rows", () => {
		const rows = applyPlugins(
			[
				{ source: "direct", pageviews: 10, visitors: 5, percentage: 50 },
				{
					source: "https://app.example.com",
					pageviews: 6,
					visitors: 3,
					percentage: 30,
				},
				{ name: "https://", pageviews: 1, visitors: 1, percentage: 5 },
				{
					source: "https://google.com",
					pageviews: 4,
					visitors: 2,
					percentage: 20,
				},
			],
			{
				plugins: {
					deduplicateReferrers: true,
					parseReferrers: true,
				},
			},
			"example.com"
		);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			name: "Direct",
			referrer: "direct",
			source: "direct",
			domain: "",
			referrer_type: "direct",
			pageviews: 17,
			visitors: 9,
			percentage: 81.82,
		});
		expect(rows[1]).toMatchObject({
			name: "Google",
			referrer: "https://google.com",
			source: "https://google.com",
			domain: "google.com",
			referrer_type: "search",
			pageviews: 4,
			visitors: 2,
			percentage: 18.18,
		});
	});

	it("deduplicates parsed click-based referrer rows", () => {
		const rows = applyPlugins(
			[
				{ referrer: "https://twitter.com", clicks: 7, percentage: 70 },
				{ referrer: "https://x.com", clicks: 3, percentage: 30 },
			],
			{
				plugins: {
					deduplicateReferrers: true,
					parseReferrers: true,
				},
			}
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			name: "Twitter",
			clicks: 10,
			percentage: 100,
			referrer_type: "social",
		});
	});

	it("builds scroll depth queries from page_exit percent values", () => {
		const summaryConfig = QueryBuilders.scroll_depth_summary;
		const distributionConfig = QueryBuilders.scroll_depth_distribution;
		const pageConfig = QueryBuilders.page_scroll_performance;
		if (!(summaryConfig && distributionConfig && pageConfig)) {
			throw new Error("scroll depth builders are missing");
		}

		const summarySql = new SimpleQueryBuilder(
			summaryConfig,
			makeRequest({ type: "scroll_depth_summary" })
		).compile().sql;
		const distributionSql = new SimpleQueryBuilder(
			distributionConfig,
			makeRequest({ type: "scroll_depth_distribution" })
		).compile().sql;
		const pageSql = new SimpleQueryBuilder(
			pageConfig,
			makeRequest({ type: "page_scroll_performance" })
		).compile().sql;

		for (const sql of [summarySql, distributionSql, pageSql]) {
			expect(sql).toContain("event_name = 'page_exit'");
			expect(sql).not.toContain("event_name = 'screen_view'");
		}
		expect(summarySql).toContain("scroll_depth ELSE NULL");
		expect(summarySql).not.toContain("scroll_depth * 100");
		expect(pageSql).toContain("scroll_depth ELSE NULL");
		expect(pageSql).not.toContain("scroll_depth * 100");
		expect(distributionSql).toContain("WHEN scroll_depth < 25");
		expect(distributionSql).toContain("WHEN scroll_depth < 100");
		expect(distributionSql).not.toContain("WHEN scroll_depth < 0.25");
	});

	it("applies request limit override", () => {
		const { sql } = compile({ limit: 10 }, { limit: 25 });
		expect(sql).toContain("LIMIT 25");
	});

	it("applies offset", () => {
		const { sql } = compile({}, { offset: 50 });
		expect(sql).toContain("OFFSET 50");
	});
});
