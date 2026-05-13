import { describe, expect, it } from "vitest";
import {
	areQueriesCompatible,
	extractOuterSelectColumns,
	getCompatibleQueries,
	getSchemaGroups,
} from "./batch-executor";
import { QueryBuilders } from "./builders";
import { SimpleQueryBuilder } from "./simple-builder";

const lastSelectColumns = extractOuterSelectColumns;

function compileSql(type: string): string {
	const config = QueryBuilders[type];
	if (!config) {
		throw new Error(`Missing config for ${type}`);
	}
	return new SimpleQueryBuilder(config, {
		projectId: "test-website",
		type,
		from: "2026-04-01",
		to: "2026-04-11",
	}).compile().sql;
}

describe("batch-executor schema signatures", () => {
	const builderEntries = Object.entries(QueryBuilders);
	const builderCases = builderEntries
		.filter(([, config]) => config.meta?.output_fields?.length)
		.map(([type, config]) => ({
			declared: config.meta?.output_fields?.map((f) => f.name) ?? [],
			type,
		}));

	it.each(builderCases)(
		"$type emits the columns declared in meta.output_fields",
		({ type, declared }) => {
			const sql = compileSql(type);
			const actual = lastSelectColumns(sql);
			expect(actual).toEqual(declared);
		}
	);

	it("groups builders that share a schema signature", () => {
		const groups = getSchemaGroups();
		const multiGroups = Array.from(groups.values()).filter(
			(types) => types.length > 1
		);
		expect(multiGroups.length).toBeGreaterThan(0);
	});

	it("reports compatible queries for a builder with peers", () => {
		const peers = getCompatibleQueries("country");
		expect(peers.length).toBeGreaterThan(0);
		expect(peers).not.toContain("country");
		for (const peer of peers) {
			expect(areQueriesCompatible("country", peer)).toBe(true);
		}
	});

	it("returns no peers for a builder without meta", () => {
		const peers = getCompatibleQueries("session_metrics");
		expect(peers).toEqual([]);
	});

	it("treats builders with different column shapes as incompatible", () => {
		expect(areQueriesCompatible("country", "region")).toBe(false);
		expect(areQueriesCompatible("country", "city")).toBe(false);
	});

	it("region and city share a signature now that meta matches their SQL", () => {
		expect(areQueriesCompatible("region", "city")).toBe(true);
	});
});
