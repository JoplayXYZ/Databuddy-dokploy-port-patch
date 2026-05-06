import { test as base } from "@playwright/test";

interface E2ESession {
	email: string;
	name: string;
	organizationId: string;
	userId: string;
	websiteId: string | null;
}

interface E2EFixtures {
	authenticatedPage: import("@playwright/test").Page;
	e2eSession: E2ESession;
}

function e2eTestKey(): string {
	const key = process.env.DATABUDDY_E2E_TEST_KEY;
	if (!key) {
		throw new Error(
			"DATABUDDY_E2E_TEST_KEY is required. Run through test:e2e:local."
		);
	}
	return key;
}

function testScope(testTitle: string): string {
	return testTitle
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, 48);
}

export const test = base.extend<E2EFixtures>({
	e2eSession: async ({ page }, use, testInfo) => {
		const response = await page
			.context()
			.request.post("/api/test/e2e/session", {
				data: {
					runScope: process.env.DATABUDDY_E2E_RUN_ID ?? "local",
					testScope: testScope(testInfo.title),
					withWebsite: true,
				},
				headers: { "x-e2e-test-key": e2eTestKey() },
			});

		if (!response.ok()) {
			throw new Error(
				`E2E session bootstrap failed with ${response.status()}: ${await response.text()}`
			);
		}
		await use((await response.json()) as E2ESession);
	},
	authenticatedPage: async ({ e2eSession: _session, page }, use) => {
		await use(page);
	},
});

export { expect } from "@playwright/test";
