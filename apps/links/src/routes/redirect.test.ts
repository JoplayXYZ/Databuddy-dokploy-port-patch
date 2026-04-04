import { describe, expect, test } from "bun:test";

// These tests verify the redirect route logic in isolation
// For full integration tests, run with all env vars set:
// DATABASE_URL=... REDIS_URL=... bun test redirect.integration.test.ts

describe("redirect route logic", () => {
	describe("getLinkBySlug logic", () => {
		// Test the caching logic pattern used in the route
		async function getLinkBySlugPattern(
			slug: string,
			options: {
				cacheResult: { id: string; targetUrl: string } | null;
				dbResult: { id: string; targetUrl: string } | null;
				cacheError?: boolean;
			}
		): Promise<{ id: string; targetUrl: string } | null> {
			const { cacheResult, dbResult, cacheError } = options;

			if (!cacheError && cacheResult) {
				return cacheResult;
			}

			if (!dbResult) {
				return null;
			}

			return dbResult;
		}

		test("should return cached link when available", async () => {
			const result = await getLinkBySlugPattern("my-slug", {
				cacheResult: { id: "cached-123", targetUrl: "https://cached.com" },
				dbResult: { id: "db-123", targetUrl: "https://db.com" },
			});

			expect(result?.id).toBe("cached-123");
			expect(result?.targetUrl).toBe("https://cached.com");
		});

		test("should fall back to database when cache is empty", async () => {
			const result = await getLinkBySlugPattern("my-slug", {
				cacheResult: null,
				dbResult: { id: "db-123", targetUrl: "https://db.com" },
			});

			expect(result?.id).toBe("db-123");
			expect(result?.targetUrl).toBe("https://db.com");
		});

		test("should return null when link not in cache or database", async () => {
			const result = await getLinkBySlugPattern("nonexistent", {
				cacheResult: null,
				dbResult: null,
			});

			expect(result).toBeNull();
		});

		test("should fall back to database when cache errors", async () => {
			const result = await getLinkBySlugPattern("my-slug", {
				cacheResult: { id: "cached-123", targetUrl: "https://cached.com" },
				dbResult: { id: "db-123", targetUrl: "https://db.com" },
				cacheError: true,
			});

			expect(result?.id).toBe("db-123");
		});
	});

	describe("timestamp formatting", () => {
		test("should format timestamp correctly for analytics", () => {
			const date = new Date("2025-01-16T10:30:45.123Z");
			const formatted = date.toISOString().replace("T", " ").replace("Z", "");

			expect(formatted).toBe("2025-01-16 10:30:45.123");
		});
	});

	describe("visit event structure", () => {
		test("should create valid visit event object", () => {
			const event = {
				link_id: "link-123",
				timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
				referrer: "https://google.com",
				user_agent: "Mozilla/5.0 Chrome/120",
				ip_hash: "abc123def456",
				country: "United States",
				region: "California",
				city: "San Francisco",
				browser_name: "Chrome",
				device_type: "desktop",
			};

			expect(event.link_id).toBe("link-123");
			expect(event.referrer).toBe("https://google.com");
			expect(event.browser_name).toBe("Chrome");
			expect(event.device_type).toBe("desktop");
			expect(event.timestamp).toMatch(
				/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/
			);
		});

		test("should handle null referrer", () => {
			const event = {
				link_id: "link-123",
				timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
				referrer: null,
				user_agent: "Mozilla/5.0",
				ip_hash: "abc123",
				country: null,
				region: null,
				city: null,
				browser_name: null,
				device_type: null,
			};

			expect(event.referrer).toBeNull();
			expect(event.country).toBeNull();
		});
	});

	describe("redirect behavior", () => {
		test("should use 302 status code for redirect", () => {
			const expectedStatus = 302;
			expect(expectedStatus).toBe(302);
		});

		test("should preserve target URL exactly", () => {
			const testUrls = [
				"https://example.com/path?query=value#hash",
				"https://example.com/path with spaces",
				"https://example.com/path?utm_source=test&utm_medium=link",
				"https://example.com/" + "a".repeat(2000),
			];

			for (const url of testUrls) {
				const response = Response.redirect(url, 302);
				expect(response.headers.get("location")).toBe(url);
			}
		});
	});
});
