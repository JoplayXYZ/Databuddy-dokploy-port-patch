import { apikey } from "@databuddy/db/schema";
import { db } from "../db";
import { nextId } from "./id";

export async function insertApiKey(
	overrides: Partial<typeof apikey.$inferInsert> & { organizationId: string }
) {
	const id = nextId("key");

	const [row] = await db()
		.insert(apikey)
		.values({
			id,
			name: `Key ${id}`,
			prefix: "db_test",
			start: id,
			keyHash: `hash-${id}`,
			type: "user",
			scopes: [],
			enabled: true,
			rateLimitEnabled: false,
			...overrides,
		})
		.returning();

	return row;
}
