import { expect, test } from "../../fixtures";

test(
	"creates and deletes an API key without leaving confirmation dialogs open",
	{ tag: ["@regression", "@core"] },
	async ({ authenticatedPage, e2eSession }) => {
		const keyName = `E2E key ${e2eSession.userId.slice(0, 8)}`;

		await authenticatedPage.goto("/organizations/settings");
		await expect(
			authenticatedPage.getByRole("heading", {
				exact: true,
				name: "API Keys",
			})
		).toBeVisible();

		await authenticatedPage
			.getByRole("button", { name: /Create (your first )?key/i })
			.first()
			.click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Create API Key" })
		).toBeVisible();

		await authenticatedPage
			.getByRole("textbox", { exact: true, name: "Name" })
			.fill(keyName);
		await authenticatedPage.getByRole("button", { name: "Create Key" }).click();
		await expect(
			authenticatedPage.getByText("Secret key", { exact: true })
		).toBeVisible();
		await authenticatedPage.getByRole("button", { name: "Done" }).click();

		await expect(authenticatedPage.getByText(keyName)).toBeVisible();
		await authenticatedPage.getByText(keyName).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: keyName })
		).toBeVisible();

		await authenticatedPage
			.getByRole("button", { name: "Destructive actions" })
			.click();
		await authenticatedPage.getByRole("button", { name: "Delete" }).click();
		await expect(
			authenticatedPage.getByRole("heading", { name: "Delete API Key?" })
		).toBeVisible();
		await authenticatedPage
			.getByRole("dialog")
			.getByRole("button", { name: "Delete" })
			.click();

		await expect(
			authenticatedPage.getByRole("heading", { name: "Delete API Key?" })
		).toBeHidden();
		await expect(
			authenticatedPage.getByRole("heading", { name: keyName })
		).toBeHidden();
		await expect(authenticatedPage.getByText(keyName)).toBeHidden();
	}
);
