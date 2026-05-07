import { expect, test } from "@/test/e2e/fixtures";
import {
	createOrganization,
	createShortLink,
	createWebsite,
	expectDashboardReady,
	linkRow,
	scopeSuffix,
	switchOrganization,
	websiteCard,
} from "@/test/e2e/utils/dashboard";

test(
	"isolates websites and links between organizations",
	{ tag: "@core" },
	async ({ authenticatedPage, e2eSession }) => {
		const suffix = scopeSuffix(e2eSession);
		const primaryOrgName = e2eSession.organizationName;
		const secondaryOrgName = `E2E Isolation ${suffix}`;
		const secondaryOrgSlug = `e2e-isolation-${suffix}`;

		const primaryWebsite = {
			domain: `primary-${suffix}.local`,
			name: `Primary Website ${suffix}`,
		};
		const secondaryWebsite = {
			domain: `secondary-${suffix}.local`,
			name: `Secondary Website ${suffix}`,
		};
		const primaryLink = {
			name: `Primary Link ${suffix}`,
			slug: `primary-link-${suffix}`,
			targetUrl: `primary-link-${suffix}.local/start`,
		};
		const secondaryLink = {
			name: `Secondary Link ${suffix}`,
			slug: `secondary-link-${suffix}`,
			targetUrl: `secondary-link-${suffix}.local/start`,
		};

		await authenticatedPage.goto("/websites");
		await expectDashboardReady(authenticatedPage);
		const primaryWebsiteCard = await createWebsite(
			authenticatedPage,
			primaryWebsite
		);
		await expect(primaryWebsiteCard).toBeVisible();

		await authenticatedPage.goto("/links");
		const primaryLinkRow = await createShortLink(authenticatedPage, primaryLink);
		await expect(primaryLinkRow).toBeVisible();

		await createOrganization(authenticatedPage, {
			name: secondaryOrgName,
			slug: secondaryOrgSlug,
		});

		await authenticatedPage.goto("/websites");
		await expect(websiteCard(authenticatedPage, primaryWebsite.name)).toBeHidden();
		await expect(authenticatedPage.getByText(primaryWebsite.domain)).toBeHidden();
		const secondaryWebsiteCard = await createWebsite(
			authenticatedPage,
			secondaryWebsite
		);
		await expect(secondaryWebsiteCard).toBeVisible();

		await authenticatedPage.goto("/links");
		await expect(linkRow(authenticatedPage, primaryLink.name)).toBeHidden();
		const secondaryLinkRow = await createShortLink(authenticatedPage, secondaryLink);
		await expect(secondaryLinkRow).toBeVisible();

		await switchOrganization(authenticatedPage, primaryOrgName);

		await authenticatedPage.goto("/websites");
		await expect(websiteCard(authenticatedPage, primaryWebsite.name)).toBeVisible();
		await expect(websiteCard(authenticatedPage, secondaryWebsite.name)).toBeHidden();
		await expect(authenticatedPage.getByText(secondaryWebsite.domain)).toBeHidden();

		await authenticatedPage.goto("/links");
		await expect(linkRow(authenticatedPage, primaryLink.name)).toBeVisible();
		await expect(linkRow(authenticatedPage, secondaryLink.name)).toBeHidden();

		await switchOrganization(authenticatedPage, secondaryOrgName);

		await authenticatedPage.goto("/websites");
		await expect(websiteCard(authenticatedPage, secondaryWebsite.name)).toBeVisible();
		await expect(websiteCard(authenticatedPage, primaryWebsite.name)).toBeHidden();
		await expect(authenticatedPage.getByText(primaryWebsite.domain)).toBeHidden();

		await authenticatedPage.goto("/links");
		await expect(linkRow(authenticatedPage, secondaryLink.name)).toBeVisible();
		await expect(linkRow(authenticatedPage, primaryLink.name)).toBeHidden();
	}
);
