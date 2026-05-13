import { describe, expect, it } from "bun:test";
import {
	areSecuritySettingsEqual,
	createSecuritySettingsPayload,
	normalizeSecurityTag,
	readSecuritySettings,
} from "./security-settings";

describe("security settings helpers", () => {
	it("keeps empty arrays in the mutation payload so removals serialize", () => {
		expect(
			createSecuritySettingsPayload({ allowedIps: [], allowedOrigins: [] })
		).toEqual({ allowedIps: [], allowedOrigins: [] });
	});

	it("reads only string lists from stored website settings", () => {
		expect(
			readSecuritySettings({
				allowedIps: ["10.0.0.1", 42],
				allowedOrigins: ["cal.com", null],
			})
		).toEqual({ allowedIps: ["10.0.0.1"], allowedOrigins: ["cal.com"] });
	});

	it("detects exact draft changes", () => {
		expect(
			areSecuritySettingsEqual(
				{ allowedIps: [], allowedOrigins: ["cal.com"] },
				{ allowedIps: [], allowedOrigins: ["cal.com"] }
			)
		).toBe(true);

		expect(
			areSecuritySettingsEqual(
				{ allowedIps: [], allowedOrigins: ["cal.com"] },
				{ allowedIps: [], allowedOrigins: [] }
			)
		).toBe(false);
	});

	it("normalizes tags before validation and duplicate checks", () => {
		expect(normalizeSecurityTag("  *.Cal.COM  ")).toBe("*.cal.com");
	});
});
