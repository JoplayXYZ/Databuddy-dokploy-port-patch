import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.DATABUDDY_E2E_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./test/e2e/specs",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: `bun next dev -p ${PORT}`,
		env: {
			DATABUDDY_E2E_MODE: process.env.DATABUDDY_E2E_MODE ?? "1",
			DATABUDDY_E2E_TEST_KEY: process.env.DATABUDDY_E2E_TEST_KEY ?? "",
			DATABASE_URL: process.env.DATABASE_URL ?? "",
			REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
			BULLMQ_REDIS_URL:
				process.env.BULLMQ_REDIS_URL ??
				process.env.REDIS_URL ??
				"redis://localhost:6379",
			CLICKHOUSE_URL:
				process.env.CLICKHOUSE_URL ??
				"http://default:@localhost:8123/databuddy_analytics",
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ??
				"databuddy-e2e-secret-at-least-32-bytes",
			BETTER_AUTH_URL: baseURL,
			DASHBOARD_URL: baseURL,
			API_URL: process.env.API_URL ?? baseURL,
			NEXT_PUBLIC_APP_URL: baseURL,
			NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? baseURL,
		},
		reuseExistingServer: process.env.DATABUDDY_E2E_REUSE_SERVER === "1",
		timeout: 120_000,
		url: baseURL,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
