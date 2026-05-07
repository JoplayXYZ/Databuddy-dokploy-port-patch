import { expect, test } from "../../fixtures";

async function openLinkActions(
	page: import("@playwright/test").Page,
	linkName: string
): Promise<void> {
	const rowLink = page.getByRole("link", { name: new RegExp(linkName) });
	await rowLink.hover();
	await page.getByRole("button", { name: `Actions for ${linkName}` }).click();
}

test(
	"creates, updates, opens, and deletes a short link",
	{ tag: "@core" },
	async ({ authenticatedPage, e2eSession }) => {
		const suffix = e2eSession.userId.slice(0, 8).toLowerCase();
		const folderName = `E2E Folder ${suffix}`;
		const linkName = `E2E Link ${suffix}`;
		const updatedName = `${linkName} Updated`;
		const slug = `e2e-${suffix}`;
		const targetUrl = `e2e-${suffix}.local/start`;
		const updatedTargetUrl = `e2e-${suffix}.local/updated`;

		await authenticatedPage.goto("/links");
		await expect(
			authenticatedPage.getByRole("heading", { name: "Links" })
		).toBeVisible();
		await authenticatedPage.getByRole("button", { name: "Folder" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Create Folder" })
		).toBeVisible();
		await authenticatedPage
			.getByRole("textbox", { name: "Folder Name" })
			.fill(folderName);
		await authenticatedPage.getByRole("button", { name: "Create Folder" }).click();
		await expect(
			authenticatedPage.getByRole("button", { name: new RegExp(folderName) })
		).toBeVisible();

		await authenticatedPage.getByRole("button", { name: "New Link" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Create Link" })
		).toBeVisible();

		await authenticatedPage
			.getByRole("textbox", { name: "Destination URL" })
			.fill(targetUrl);
		await authenticatedPage.getByRole("textbox", { name: "Name" }).fill(linkName);
		await authenticatedPage
			.getByRole("textbox", { name: /Short Link/ })
			.fill(slug);
		const createDialog = authenticatedPage.getByRole("dialog", {
			name: "Create Link",
		});
		await createDialog
			.getByRole("button", { name: "Folder: Unfiled" })
			.click();
		await authenticatedPage.getByRole("menuitem", { name: folderName }).click();
		await authenticatedPage.getByRole("button", { name: "Create Link" }).click();

		const linkRow = authenticatedPage.getByRole("link", {
			name: new RegExp(linkName),
		});
		await expect(linkRow).toBeVisible();
		await expect(authenticatedPage.getByText(new RegExp(slug))).toBeVisible();
		await expect(
			authenticatedPage.getByRole("button", { name: new RegExp(`${folderName}\\s+1`) })
		).toBeVisible();

		await linkRow.click();
		await expect(authenticatedPage).toHaveURL(/\/links\/[A-Za-z0-9_-]+/);
		await expect(authenticatedPage.getByText(linkName)).toBeVisible();
		await expect(authenticatedPage.getByText("Total Clicks")).toBeVisible();

		await authenticatedPage.goto("/links");
		await openLinkActions(authenticatedPage, linkName);
		await authenticatedPage.getByRole("menuitem", { name: "Edit" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Edit Link" })
		).toBeVisible();
		await authenticatedPage
			.getByRole("textbox", { name: "Destination URL" })
			.fill(updatedTargetUrl);
		await authenticatedPage
			.getByRole("textbox", { name: "Name" })
			.fill(updatedName);
		await authenticatedPage.getByRole("button", { name: "Save Changes" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Edit Link" })
		).toBeHidden();
		await expect(
			authenticatedPage.getByRole("link", { name: new RegExp(updatedName) })
		).toBeVisible();

		await openLinkActions(authenticatedPage, updatedName);
		await authenticatedPage.getByRole("menuitem", { name: "Delete" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Delete Link" })
		).toBeVisible();
		await authenticatedPage
			.getByRole("dialog")
			.getByRole("button", { name: "Delete Link" })
			.click();

		await expect(
			authenticatedPage.getByRole("link", { name: new RegExp(updatedName) })
		).toBeHidden();
	}
);
