import { expect, test } from "../../fixtures";

test(
	"redirects unauthenticated visitors to sign in",
	{ tag: "@smoke" },
	async ({ page }) => {
		await page.goto("/settings/account");
		await expect(page).toHaveURL(/sign-in|login|auth/);
	}
);

test(
	"boots an authenticated browser session",
	{ tag: "@smoke" },
	async ({ authenticatedPage, e2eSession }) => {
		await authenticatedPage.goto("/settings/account");

		await expect(
			authenticatedPage.getByRole("heading", { name: "Basic Information" })
		).toBeVisible();
		await expect(authenticatedPage.locator('input[type="email"]')).toHaveValue(
			e2eSession.email
		);
		await expect(authenticatedPage.getByPlaceholder("Your name…")).toHaveValue(
			e2eSession.name
		);
	}
);
