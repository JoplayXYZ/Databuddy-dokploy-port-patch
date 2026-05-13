import { describe, expect, it } from "bun:test";
import { mergeWebsiteSecuritySettings } from "./website-settings";

describe("mergeWebsiteSecuritySettings", () => {
	it("clears all security settings when the patch is empty", () => {
		expect(
			mergeWebsiteSecuritySettings(
				{ allowedOrigins: ["test.databuddy.cc"] },
				{}
			)
		).toBeNull();
	});

	it("clears a list when the patch sends an explicit empty array", () => {
		expect(
			mergeWebsiteSecuritySettings(
				{
					allowedIps: ["10.0.0.1"],
					allowedOrigins: ["test.databuddy.cc"],
				},
				{ allowedOrigins: [] }
			)
		).toEqual({ allowedIps: ["10.0.0.1"] });
	});

	it("returns null when both lists are cleared", () => {
		expect(
			mergeWebsiteSecuritySettings(
				{
					allowedIps: ["10.0.0.1"],
					allowedOrigins: ["test.databuddy.cc"],
				},
				{ allowedIps: [], allowedOrigins: [] }
			)
		).toBeNull();
	});

	it("updates provided lists while preserving omitted lists", () => {
		expect(
			mergeWebsiteSecuritySettings(
				{ allowedIps: ["10.0.0.1"] },
				{ allowedOrigins: ["cal.com"] }
			)
		).toEqual({ allowedIps: ["10.0.0.1"], allowedOrigins: ["cal.com"] });
	});
});
