import { expect, test } from "../../fixtures";

function websiteIdFromUrl(url: string): string {
	const match = new URL(url).pathname.match(/\/websites\/([^/]+)/);
	if (!match?.[1]) {
		throw new Error(`Could not read website id from URL: ${url}`);
	}
	return match[1];
}

test(
	"creates, updates, and deletes a website",
	{ tag: "@core" },
	async ({ authenticatedPage, e2eSession }) => {
		const suffix = e2eSession.userId.slice(0, 8);
		const websiteName = `E2E Website ${suffix}`;
		const updatedName = `${websiteName} Updated`;
		const domain = `e2e-${suffix}.local`;

		await authenticatedPage.goto("/websites");
		await expect(
			authenticatedPage.getByRole("button", { name: /Workspace|organization/i })
		).toBeVisible();
		await authenticatedPage.getByRole("button", { name: "New Website" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Create a new website" })
		).toBeVisible();

		await authenticatedPage.getByRole("textbox", { name: "Name" }).fill(websiteName);
		await authenticatedPage.getByRole("textbox", { name: "Domain" }).fill(domain);
		await authenticatedPage
			.getByRole("button", { name: "Create website" })
			.click();

		const websiteLink = authenticatedPage.getByRole("link", {
			name: `Open ${websiteName} analytics`,
		});
		await expect(websiteLink).toBeVisible();
		await expect(authenticatedPage.getByText(domain)).toBeVisible();

		await websiteLink.click();
		await expect(authenticatedPage).toHaveURL(/\/websites\/[A-Za-z0-9_-]+/);
		const websiteId = websiteIdFromUrl(authenticatedPage.url());

		await authenticatedPage.goto(`/websites/${websiteId}/settings/general`);
		await expect(authenticatedPage.getByText(websiteName)).toBeVisible();
		await expect(authenticatedPage.getByText(domain)).toBeVisible();

		await authenticatedPage.getByRole("button", { name: "Edit" }).first().click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Edit Website" })
		).toBeVisible();
		await authenticatedPage.getByRole("textbox", { name: "Name" }).fill(updatedName);
		await authenticatedPage.getByRole("button", { name: "Save changes" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Edit Website" })
		).toBeHidden();
		await authenticatedPage.reload();
		await expect(authenticatedPage.getByText(updatedName)).toBeVisible();

		await authenticatedPage
			.getByRole("button", { exact: true, name: "Delete" })
			.click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Delete Website" })
		).toBeVisible();
		await authenticatedPage
			.getByRole("dialog")
			.getByRole("button", { name: "Delete Website" })
			.click();

		await expect(authenticatedPage).toHaveURL(/\/websites$/);
		await expect(authenticatedPage.getByText(updatedName)).toBeHidden();
	}
);
