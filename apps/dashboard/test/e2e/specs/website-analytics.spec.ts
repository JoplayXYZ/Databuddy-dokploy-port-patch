import { expect, test } from "../fixtures";

test("renders analytics controls in the website topbar", async ({
	authenticatedPage,
	e2eSession,
}) => {
	expect(e2eSession.websiteId).toBeTruthy();

	await authenticatedPage.goto(`/demo/${e2eSession.websiteId}`);

	await expect(authenticatedPage.getByRole("radio", { name: "Daily" })).toBeVisible();
	await expect(authenticatedPage.getByRole("radio", { name: "Hourly" })).toBeVisible();
	await expect(authenticatedPage.getByRole("button", { name: "24h" })).toBeVisible();
	await expect(authenticatedPage.getByRole("button", { name: "7d" })).toBeVisible();
	await expect(authenticatedPage.getByRole("button", { name: "30d" })).toBeVisible();
	await expect(authenticatedPage.getByRole("button", { name: "Filter" })).toBeVisible();

	await authenticatedPage.getByRole("button", { name: "7d" }).click();
	await expect(authenticatedPage).toHaveURL(/startDate=/);
});
