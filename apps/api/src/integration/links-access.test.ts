import "@databuddy/test/env";

import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { withWorkspace } from "@databuddy/rpc";
import {
	reset,
	cleanup,
	hasTestDb,
	userContext,
	apiKeyContext,
	expectCode,
	insertOrganization,
	signUp,
	addToOrganization,
} from "@databuddy/test";

const iit = hasTestDb ? it : it.skip;

beforeEach(() => reset());
afterAll(() => cleanup());

describe("link resource permissions", () => {
	describe("user path", () => {
		iit("allows viewer to read links", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "viewer");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "link",
				permissions: ["read"],
			});
			expect(ws.role).toBe("viewer");
		});

		iit("allows member to create links", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "member");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "link",
				permissions: ["create"],
			});
			expect(ws.role).toBe("member");
		});

		iit("denies viewer from creating links", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "viewer");

			await expectCode(
				withWorkspace(userContext(user, org.id), {
					organizationId: org.id,
					resource: "link",
					permissions: ["create"],
				}),
				"FORBIDDEN",
			);
		});

		iit("denies member from deleting links", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "member");

			await expectCode(
				withWorkspace(userContext(user, org.id), {
					organizationId: org.id,
					resource: "link",
					permissions: ["delete"],
				}),
				"FORBIDDEN",
			);
		});

		iit("allows admin to delete links", async () => {
			const user = await signUp();
			const org = await insertOrganization();
			await addToOrganization(user.id, org.id, "admin");

			const ws = await withWorkspace(userContext(user, org.id), {
				organizationId: org.id,
				resource: "link",
				permissions: ["delete"],
			});
			expect(ws.role).toBe("admin");
		});
	});

	describe("API key path — link resource uses default scope map", () => {
		iit("allows read:data scope to read links", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");

			const ws = await withWorkspace(apiKeyContext(org.id, ["read:data"]), {
				organizationId: org.id,
				resource: "link",
				permissions: ["read"],
			});
			expect(ws.user).toBeNull();
		});

		iit("denies read:data scope from creating links", async () => {
			const org = await insertOrganization();

			await expectCode(
				withWorkspace(apiKeyContext(org.id, ["read:data"]), {
					organizationId: org.id,
					resource: "link",
					permissions: ["create"],
				}),
				"FORBIDDEN",
			);
		});

		iit("allows manage:config scope to create links", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");

			const ws = await withWorkspace(
				apiKeyContext(org.id, ["manage:config"]),
				{
					organizationId: org.id,
					resource: "link",
					permissions: ["create"],
				},
			);
			expect(ws.user).toBeNull();
		});

		iit("allows manage:config scope to delete links", async () => {
			const org = await insertOrganization();
			const owner = await signUp();
			await addToOrganization(owner.id, org.id, "owner");

			const ws = await withWorkspace(
				apiKeyContext(org.id, ["manage:config"]),
				{
					organizationId: org.id,
					resource: "link",
					permissions: ["delete"],
				},
			);
			expect(ws.user).toBeNull();
		});

		iit("denies key with no scopes on link resource", async () => {
			const org = await insertOrganization();

			await expectCode(
				withWorkspace(apiKeyContext(org.id, []), {
					organizationId: org.id,
					resource: "link",
					permissions: ["read"],
				}),
				"FORBIDDEN",
			);
		});
	});
});
