import { describe, expect, it } from "bun:test";
import { createConfig } from "./app";

describe("createConfig", () => {
	it("uses local defaults outside production", () => {
		expect(createConfig({ NODE_ENV: "development" })).toMatchObject({
			urls: {
				api: "http://localhost:3001",
				basket: "http://localhost:4000",
				dashboard: "http://localhost:3000",
				status: "http://localhost:3002",
			},
		});
	});

	it("uses cloud defaults in production", () => {
		expect(createConfig({ NODE_ENV: "production" })).toMatchObject({
			urls: {
				api: "https://api.databuddy.cc",
				basket: "https://basket.databuddy.cc",
				dashboard: "https://app.databuddy.cc",
				status: "https://status.databuddy.cc",
			},
		});
	});

	it("prefers self-hosting urls and strips trailing slashes", () => {
		expect(
			createConfig({
				API_URL: "https://api.example.com/",
				DASHBOARD_URL: "https://app.example.com/",
				NODE_ENV: "production",
			})
		).toMatchObject({
			urls: {
				api: "https://api.example.com",
				dashboard: "https://app.example.com",
			},
		});
	});

	it("does not let localhost leak into production redirects", () => {
		expect(
			createConfig({
				BETTER_AUTH_URL: "http://localhost:3000",
				NODE_ENV: "production",
			})
		).toMatchObject({ urls: { dashboard: "https://app.databuddy.cc" } });
	});
});
