import { describe, expect, it } from "vitest";
import { isPublicQueryAccess } from "./public-query-access";

describe("isPublicQueryAccess", () => {
	it("allows only query types explicitly marked public-readable", () => {
		expect(
			isPublicQueryAccess([
				"summary_metrics",
				"top_pages",
				"custom_events_summary",
				"recent_errors",
				"vitals_overview",
			])
		).toBe(true);
	});

	it("denies revenue, unknown, and empty public query requests", () => {
		expect(isPublicQueryAccess(["revenue_overview"])).toBe(false);
		expect(isPublicQueryAccess(["summary_metrics", "revenue_overview"])).toBe(
			false
		);
		expect(isPublicQueryAccess(["missing_query_type"])).toBe(false);
		expect(isPublicQueryAccess([])).toBe(false);
	});
});
