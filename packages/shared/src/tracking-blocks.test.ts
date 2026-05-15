import { describe, expect, test } from "bun:test";
import {
	getTrackingBlockOriginHost,
	isActionableTrackingBlockReason,
	isIgnoredTrackingBlockOrigin,
} from "./tracking-blocks";

describe("tracking block helpers", () => {
	test("detects actionable block reasons", () => {
		expect(isActionableTrackingBlockReason("origin_not_authorized")).toBe(
			true
		);
		expect(isActionableTrackingBlockReason("known_scraper")).toBe(false);
	});

	test("extracts origin host safely", () => {
		expect(getTrackingBlockOriginHost("https://Example.COM/path")).toBe(
			"example.com"
		);
		expect(getTrackingBlockOriginHost("not a url")).toBe("not a url");
		expect(getTrackingBlockOriginHost("https://example.org.")).toBe(
			"example.org"
		);
		expect(getTrackingBlockOriginHost(null)).toBeNull();
	});

	test("ignores local/dev origins", () => {
		expect(isIgnoredTrackingBlockOrigin("http://localhost:3000")).toBe(true);
		expect(isIgnoredTrackingBlockOrigin("http://127.0.0.1:3000")).toBe(true);
		expect(isIgnoredTrackingBlockOrigin("http://192.168.1.4:5173")).toBe(
			true
		);
		expect(isIgnoredTrackingBlockOrigin("https://app.local")).toBe(true);
		expect(isIgnoredTrackingBlockOrigin("null")).toBe(true);
		expect(
			isIgnoredTrackingBlockOrigin(
				"https://mock-preview.local-credentialless.webcontainer-api.io"
			)
		).toBe(true);
		expect(isIgnoredTrackingBlockOrigin("https://example.com")).toBe(false);
		expect(isIgnoredTrackingBlockOrigin(null)).toBe(false);
	});
});
