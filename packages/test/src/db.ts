// biome-ignore lint/performance/noNamespaceImport: drizzle requires schema object
import * as schema from "@databuddy/db/schema";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const DEFAULT_DATABASE_URL =
	"postgres://databuddy:databuddy_dev_password@localhost:5432/databuddy_test";

function databaseUrl(): string {
	return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export type DB = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let instance: DB | null = null;

export const hasTestDb = await (async () => {
	const p = new Pool({ connectionString: databaseUrl(), max: 1 });
	try {
		const c = await p.connect();
		c.release();
		return true;
	} catch {
		return false;
	} finally {
		await p.end();
	}
})();

export function db(): DB {
	if (!instance) {
		pool = new Pool({
			connectionString: databaseUrl(),
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
