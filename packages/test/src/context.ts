import { auth, type User } from "@databuddy/auth";
import type { Context } from "@databuddy/rpc";
import { db } from "./db";

type TestUser = { id: string; name: string; email: string } & Partial<
	Omit<User, "id" | "name" | "email">
>;

interface ContextOverrides {
	apiKey?: Context["apiKey"];
	headers?: Headers;
	organizationId?: string | null;
	session?: Context["session"];
	user?: TestUser;
}

export function context(overrides: ContextOverrides = {}): Context {
	const user = overrides.user
		? ({
				emailVerified: true,
				image: null,
				firstName: null,
				lastName: null,
				status: "ACTIVE",
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				role: "USER",
				twoFactorEnabled: false,
				...overrides.user,
			} as User)
		: undefined;

	const now = new Date();
	const session: Context["session"] =
		overrides.session ??
		(user
			? {
					id: `session-${user.id}`,
					expiresAt: new Date(Date.now() + 86_400_000),
					token: `token-${user.id}`,
					createdAt: now,
					updatedAt: now,
					ipAddress: "127.0.0.1",
					userAgent: "test",
					userId: user.id,
					activeOrganizationId: overrides.organizationId ?? null,
				}
			: undefined);

	return {
		db: db() as Context["db"],
		auth,
		session,
		user,
		apiKey: overrides.apiKey,
		getBilling: async () => undefined,
		organizationId: overrides.organizationId ?? null,
		headers: overrides.headers ?? new Headers(),
	};
}
