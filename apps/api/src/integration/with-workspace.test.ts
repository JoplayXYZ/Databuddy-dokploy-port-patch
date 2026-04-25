import "@databuddy/test/env";

import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { withWorkspace } from "@databuddy/rpc";
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

beforeEach(() => reset());
afterAll(() => cleanup());

describe("withWorkspace", () => {
	describe("no auth", () => {
		iit("rejects when no user or apiKey", async () => {
			const org = await insertOrganization();
			await expectCode(
				withWorkspace(context(), { organizationId: org.id }),
				"UNAUTHORIZED",
			);
		});
	});

	describe("org resolution", () => {
		iit("rejects when no org is resolvable", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");

			const ctx = context({
				user: { id: user.id, name: "test", email: user.email },
				headers: user.headers,
			});

			await expectCode(withWorkspace(ctx), "BAD_REQUEST");
		});

		iit("resolves org from websiteId when no explicit org", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");
			const site = await insertWebsite({ organizationId: org.id });

			const ws = await withWorkspace(userContext(user, org.id), {
				websiteId: site.id,
			});
			expect(ws.organizationId).toBe(org.id);
			expect(ws.website?.id).toBe(site.id);
		});
	});

	describe("website loading", () => {
		iit("rejects for nonexistent website", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");

			await expectCode(
				withWorkspace(userContext(user, org.id), { websiteId: "nonexistent" }),
				"NOT_FOUND",
			);
		});
	});

	describe("user membership + permissions", () => {
		iit("allows owner with read permission", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "website",
				permissions: ["read"],
			});
			expect(ws.role).toBe("owner");
			expect(ws.isPublicAccess).toBe(false);
		});

		iit("allows viewer to read website", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "viewer");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "website",
				permissions: ["read"],
			});
			expect(ws.role).toBe("viewer");
		});

		iit("denies viewer from updating website", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "viewer");

			await expectCode(
				withWorkspace(userContext(user, org.id), {
					organizationId: org.id,
					resource: "website",
					permissions: ["update"],
				}),
				"FORBIDDEN",
			);
		});

		iit("denies member from creating website", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "member");

			await expectCode(
				withWorkspace(userContext(user, org.id), {
					organizationId: org.id,
					resource: "website",
					permissions: ["create"],
				}),
				"FORBIDDEN",
			);
		});

		iit("allows admin to create website", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "admin");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "website",
				permissions: ["create"],
			});
			expect(ws.role).toBe("admin");
		});

		iit("denies user who is not a member of the org", async () => {
			const user = await signUp();
			const org = await insertOrganization();

			await expectCode(
				withWorkspace(userContext(user, org.id), { organizationId: org.id }),
				"FORBIDDEN",
			);
		});

		iit("denies cross-org access via websiteId", async () => {
			const user = await signUp();
			const orgA = await insertOrganization();
			const orgB = await insertOrganization();
			await addToOrganization(user.id, orgA.id, "owner");
			const siteInB = await insertWebsite({ organizationId: orgB.id });

			await expectCode(
				withWorkspace(userContext(user, orgA.id), {
					websiteId: siteInB.id,
					permissions: ["read"],
				}),
				"FORBIDDEN",
			);
		});
	});

	describe("API key path", () => {
		iit("denies API key with wrong org", async () => {
			const orgA = await insertOrganization();
			const orgB = await insertOrganization();

			await expectCode(
				withWorkspace(apiKeyContext(orgA.id, ["read:data"], orgB.id), {
					organizationId: orgB.id,
				}),
				"FORBIDDEN",
			);
		});

		iit("allows API key with read:data scope to read", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");

			const ws = await withWorkspace(apiKeyContext(org.id, ["read:data"]), {
				organizationId: org.id,
				resource: "website",
				permissions: ["read"],
			});
			expect(ws.user).toBeNull();
			expect(ws.role).toBeNull();
		});

		iit("denies API key with read:data from writing", async () => {
			const org = await insertOrganization();

			await expectCode(
				withWorkspace(apiKeyContext(org.id, ["read:data"]), {
					organizationId: org.id,
					resource: "website",
					permissions: ["update"],
				}),
				"FORBIDDEN",
			);
		});

		iit("allows API key with manage:websites to create website", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");

			const ws = await withWorkspace(
				apiKeyContext(org.id, ["manage:websites"]),
				{
					organizationId: org.id,
					resource: "website",
					permissions: ["create"],
				},
			);
			expect(ws.user).toBeNull();
		});

		iit("denies API key with no scopes", async () => {
			const org = await insertOrganization();

			await expectCode(
				withWorkspace(apiKeyContext(org.id, []), {
					organizationId: org.id,
					resource: "website",
					permissions: ["read"],
				}),
				"FORBIDDEN",
			);
		});
	});

	describe("public access", () => {
		iit("allows unauthenticated read on public website", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");
			const site = await insertWebsite({
				organizationId: org.id,
				isPublic: true,
			});

			const ws = await withWorkspace(context(), {
				websiteId: site.id,
				permissions: ["read"],
				allowPublicAccess: true,
			});
			expect(ws.isPublicAccess).toBe(true);
			expect(ws.user).toBeNull();
			expect(ws.website?.id).toBe(site.id);
		});

		iit("denies unauthenticated write on public website", async () => {
			const org = await insertOrganization();
			const site = await insertWebsite({
				organizationId: org.id,
				isPublic: true,
			});

			await expectCode(
				withWorkspace(context(), {
					websiteId: site.id,
					permissions: ["update"],
					allowPublicAccess: true,
				}),
				"UNAUTHORIZED",
			);
		});

		iit("denies unauthenticated read on private website even with allowPublicAccess", async () => {
			const org = await insertOrganization();
			const site = await insertWebsite({
				organizationId: org.id,
				isPublic: false,
			});

			await expectCode(
				withWorkspace(context(), {
					websiteId: site.id,
					permissions: ["read"],
					allowPublicAccess: true,
				}),
				"UNAUTHORIZED",
			);
		});
	});

	describe("plan gating", () => {
		iit("rejects when required plan not met", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");

			await expectCode(
				withWorkspace(userContext(user, org.id), {
					organizationId: org.id,
					requiredPlans: ["pro"],
				}),
				"FEATURE_UNAVAILABLE",
			);
		});

		iit("allows when no plan requirement", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "owner");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
			});
			expect(ws.plan).toBe("free");
		});
	});
});
