// biome-ignore lint/performance/noNamespaceImport: drizzle requires schema object
import * as schema from "@databuddy/db/schema";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const DATABASE_URL =
	"postgres://databuddy:databuddy_dev_password@localhost:5432/databuddy_test";

export type DB = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let instance: DB | null = null;

export function db(): DB {
	if (!instance) {
		pool = new Pool({
			connectionString: DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 5000,
		});
		instance = drizzle(pool, { schema });
	}
	return instance;
}

const TABLES = [
	"apikey",
	"websites",
	"member",
	"invitation",
	"session",
	"account",
	"two_factor",
	"sso_provider",
	"user_preferences",
	"team",
	"organization",
	"user",
] as const;

export async function truncatePostgres() {
	const quoted = TABLES.map((t) => `"${t}"`).join(", ");
	await db().execute(sql.raw(`TRUNCATE TABLE ${quoted} CASCADE`));
}

export async function closePostgres() {
	instance = null;
	if (pool) {
		await pool.end();
		pool = null;
	}
}
