import { expect, test } from "@/test/e2e/fixtures";

function formattedCount(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

test(
	"renders analytics controls in the website topbar",
	{ tag: ["@regression", "@core"] },
	async ({ authenticatedPage, e2eSession }) => {
		expect(e2eSession.websiteId).toBeTruthy();

		await authenticatedPage.goto(`/demo/${e2eSession.websiteId}`);

		const topbar = authenticatedPage.getByRole("toolbar", {
			name: "Dashboard top bar",
		});
		await expect(topbar).toBeVisible();
		await expect(topbar.getByRole("radio", { name: "Daily" })).toBeVisible();
		await expect(topbar.getByRole("radio", { name: "Hourly" })).toBeVisible();
		await expect(topbar.getByRole("button", { name: "24h" })).toBeVisible();
		await expect(topbar.getByRole("button", { name: "7d" })).toBeVisible();
		await expect(topbar.getByRole("button", { name: "30d" })).toBeVisible();
		await expect(topbar.getByRole("button", { name: "Filter" })).toBeVisible();

		await topbar.getByRole("button", { name: "7d" }).click();
		await expect(authenticatedPage).toHaveURL(/startDate=/);
	}
);

test(
	"shows seeded analytics data and applies a topbar filter",
	{ tag: ["@regression", "@core"] },
	async ({ authenticatedPage, e2eSession }) => {
		expect(e2eSession.websiteId).toBeTruthy();

		await authenticatedPage.goto(`/demo/${e2eSession.websiteId}`);

		expect(e2eSession.analyticsSeed).toBeTruthy();
		const seed = e2eSession.analyticsSeed;
		if (!seed) {
			throw new Error("Expected E2E analytics seed metadata");
		}

		await expect(
			authenticatedPage.getByText(formattedCount(seed.screenViews)).first()
		).toBeVisible({ timeout: 20_000 });
		const topSeededPath = Object.entries(seed.screenViewsByPath).sort(
			([, a], [, b]) => b - a
		)[0]?.[0];
		expect(topSeededPath).toBeTruthy();
		await expect(
			authenticatedPage.getByText(topSeededPath ?? "/").first()
		).toBeVisible();

		const topbar = authenticatedPage.getByRole("toolbar", {
			name: "Dashboard top bar",
		});
		await topbar.getByRole("button", { name: "Filter" }).click();

		await authenticatedPage.getByPlaceholder("Search fields…").fill("Country");
		await authenticatedPage.getByText("Country", { exact: true }).click();
		await authenticatedPage.getByPlaceholder("Enter country…").fill("US");
		await authenticatedPage.getByRole("button", { name: "Add filter" }).click();

		const main = authenticatedPage.getByRole("main");
		await expect(main.getByText("Country")).toBeVisible();
		await expect(main.getByText("US", { exact: true })).toBeVisible();
		await expect(
			main.getByText(formattedCount(seed.screenViewsByCountry.US ?? 0)).first()
		).toBeVisible({ timeout: 20_000 });
	}
);
