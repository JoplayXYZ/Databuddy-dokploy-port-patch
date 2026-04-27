import "@databuddy/test/env";

import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { appRouter } from "@databuddy/rpc";
import {
	reset,
	cleanup,
	context,
	hasTestDb,
	userContext,
	apiKeyContext,
	expectCode,
	insertOrganization,
	insertWebsite,
	signUp,
	addToOrganization,
} from "@databuddy/test";

const iit = hasTestDb ? it : it.skip;
const handler = {
	create: appRouter.websites.create["~orpc"].handler,
	list: appRouter.websites.list["~orpc"].handler,
	getById: appRouter.websites.getById["~orpc"].handler,
};

beforeEach(() => reset());
afterAll(() => cleanup());

describe("websites.create", () => {
	iit("creates a website for an authorized user", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "admin");

		const result = await handler.create({
			context: userContext(user, org.id),
			input: {
				name: "My Site",
				domain: "mysite.example.com",
				organizationId: org.id,
			},
		});

		expect(result.domain).toBe("mysite.example.com");
		expect(result.name).toBe("My Site");
		expect(result.organizationId).toBe(org.id);
		expect(result.status).toBe("ACTIVE");
		expect(result.id).toBeDefined();
	});

	iit("rejects unauthorized user", async () => {
		const user = await signUp();
		const org = await insertOrganization();

		await expectCode(
			handler.create({
				context: userContext(user, org.id),
				input: {
					name: "My Site",
					domain: "mysite.example.com",
					organizationId: org.id,
				},
			}),
			"FORBIDDEN",
		);
	});

	iit("rejects viewer from creating", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "viewer");

		await expectCode(
			handler.create({
				context: userContext(user, org.id),
				input: {
					name: "My Site",
					domain: "viewer-site.example.com",
					organizationId: org.id,
				},
			}),
			"FORBIDDEN",
		);
	});

	iit("rejects duplicate domain in same org", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "admin");

		const domain = `dupe-${Date.now()}.example.com`;

		await handler.create({
			context: userContext(user, org.id),
			input: { name: "First", domain, organizationId: org.id },
		});

		await expectCode(
			handler.create({
				context: userContext(user, org.id),
				input: { name: "Second", domain, organizationId: org.id },
			}),
			"CONFLICT",
		);
	});

	iit("allows API key with manage:websites scope", async () => {
		const org = await insertOrganization();
		const owner = await signUp();
		await addToOrganization(owner.id, org.id, "owner");

		const result = await handler.create({
			context: apiKeyContext(org.id, ["manage:websites"]),
			input: {
				name: "API Site",
				domain: "api-site.example.com",
				organizationId: org.id,
			},
		});

		expect(result.domain).toBe("api-site.example.com");
		expect(result.organizationId).toBe(org.id);
	});
});

describe("websites.list", () => {
	iit("returns websites for the org", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "owner");
		await insertWebsite({ organizationId: org.id });
		await insertWebsite({ organizationId: org.id });

		const result = await handler.list({
			context: userContext(user, org.id),
			input: { organizationId: org.id },
		});

		expect(result).toHaveLength(2);
	});

	iit("does not return websites from other orgs", async () => {
		const user = await signUp();
		const orgA = await insertOrganization();
		const orgB = await insertOrganization();
		await addToOrganization(user.id, orgA.id, "owner");
		await insertWebsite({ organizationId: orgA.id });
		await insertWebsite({ organizationId: orgB.id });

		const result = await handler.list({
			context: userContext(user, orgA.id),
			input: { organizationId: orgA.id },
		});

		expect(result).toHaveLength(1);
		expect(result[0].organizationId).toBe(orgA.id);
	});

	iit("returns empty array for org with no websites", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "owner");

		const result = await handler.list({
			context: userContext(user, org.id),
			input: { organizationId: org.id },
		});

		expect(result).toEqual([]);
	});
});

describe("websites.getById", () => {
	iit("returns website for authenticated user", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "owner");
		const site = await insertWebsite({ organizationId: org.id });

		const result = await handler.getById({
			context: userContext(user, org.id),
			input: { id: site.id },
		});

		expect(result.id).toBe(site.id);
		expect(result.domain).toBe(site.domain);
	});

	iit("returns public website for unauthenticated user", async () => {
		const org = await insertOrganization();
		const owner = await signUp();
		await addToOrganization(owner.id, org.id, "owner");
		const site = await insertWebsite({
			organizationId: org.id,
			isPublic: true,
		});

		const result = await handler.getById({
			context: context(),
			input: { id: site.id },
		});

		expect(result.id).toBe(site.id);
	});

	iit("rejects private website for unauthenticated user", async () => {
		const org = await insertOrganization();
		const site = await insertWebsite({
			organizationId: org.id,
			isPublic: false,
		});

		await expectCode(
			handler.getById({
				context: context(),
				input: { id: site.id },
			}),
			"UNAUTHORIZED",
		);
	});

	iit("rejects nonexistent website", async () => {
		const user = await signUp();
		const org = await insertOrganization();
		await addToOrganization(user.id, org.id, "owner");

		await expectCode(
			handler.getById({
				context: userContext(user, org.id),
				input: { id: "nonexistent" },
			}),
			"NOT_FOUND",
		);
	});
});
