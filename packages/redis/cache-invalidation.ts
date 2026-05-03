import { getRedisCache } from "./redis";

/**
 * Stringifies arguments in the same way as cacheable function
 * to generate consistent cache keys.
 */
function stringify(obj: unknown): string {
	if (obj === null) {
		return "null";
	}
	if (obj === undefined) {
		return "undefined";
	}
	if (typeof obj === "boolean") {
		return obj ? "true" : "false";
	}
	if (typeof obj === "number" || typeof obj === "string") {
		return String(obj);
	}
	if (typeof obj === "function") {
		return obj.toString();
	}
	if (Array.isArray(obj)) {
		return `[${obj.map(stringify).join(",")}]`;
	}
	if (typeof obj === "object") {
		return Object.entries(obj)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${k}:${stringify(v)}`)
			.join(":");
	}
	return String(obj);
}

/**
 * Generates a cache key for a cacheable function with the given prefix and arguments.
 * This matches the format used by the cacheable wrapper.
 */
export function getCacheableKey(prefix: string, ...args: unknown[]): string {
	return `cacheable:${prefix}:${stringify(args)}`;
}

export const AGENT_CONTEXT_SNAPSHOT_PREFIX = "agent:context-snapshot";
const AGENT_CONTEXT_SNAPSHOT_STALE_AT = new Date(0).toISOString();

export function getAgentContextSnapshotKey(
	userId: string,
	websiteId: string,
	organizationId?: string | null
): string {
	const ownerId = organizationId ?? userId;
	return `${AGENT_CONTEXT_SNAPSHOT_PREFIX}:${ownerId}:${websiteId}`;
}

async function markAgentContextSnapshotStale(key: string): Promise<number> {
	const redis = getRedisCache();
	const cached = await redis.get(key);
	if (!cached) {
		return 0;
	}

	try {
		const parsed = JSON.parse(cached) as unknown;
		if (!(parsed && typeof parsed === "object")) {
			await redis.del(key);
			return 1;
		}
		const snapshot = parsed as Record<string, unknown>;
		if (typeof snapshot.context !== "string") {
			await redis.del(key);
			return 1;
		}
		const ttl = await redis.ttl(key);
		if (ttl === -2) {
			return 0;
		}
		const stale = JSON.stringify({
			...snapshot,
			refreshedAt: AGENT_CONTEXT_SNAPSHOT_STALE_AT,
		});
		if (ttl > 0) {
			await redis.setex(key, ttl, stale);
			return 1;
		}
		await redis.set(key, stale);
		return 1;
	} catch {
		await redis.del(key);
		return 1;
	}
}

async function markAgentContextSnapshotsStale(
	pattern: string
): Promise<number> {
	const redis = getRedisCache();
	let markedCount = 0;
	let cursor = "0";
	do {
		const [nextCursor, keys] = (await redis.scan(
			cursor,
			"MATCH",
			pattern,
			"COUNT",
			100
		)) as [string, string[]];
		cursor = nextCursor;

		if (keys.length > 0) {
			const counts = await Promise.all(
				keys.map((key) => markAgentContextSnapshotStale(key))
			);
			markedCount += counts.reduce((sum, count) => sum + count, 0);
		}
	} while (cursor !== "0");
	return markedCount;
}

export async function invalidateAgentContextSnapshot(
	userId: string,
	websiteId: string,
	organizationId?: string | null
): Promise<void> {
	try {
		await markAgentContextSnapshotStale(
			getAgentContextSnapshotKey(userId, websiteId, organizationId)
		);
	} catch {
		// Agent context is advisory; cache invalidation should not fail mutations.
	}
}

export async function invalidateAgentContextSnapshotsForWebsite(
	websiteId: string
): Promise<number> {
	try {
		return await markAgentContextSnapshotsStale(
			`${AGENT_CONTEXT_SNAPSHOT_PREFIX}:*:${websiteId}`
		);
	} catch {
		return 0;
	}
}

export async function invalidateAgentContextSnapshotsForOwner(
	ownerId: string
): Promise<number> {
	try {
		return await markAgentContextSnapshotsStale(
			`${AGENT_CONTEXT_SNAPSHOT_PREFIX}:${ownerId}:*`
		);
	} catch {
		return 0;
	}
}

/**
 * Invalidates a specific cacheable cache entry by prefix and exact arguments.
 */
export async function invalidateCacheableKey(
	prefix: string,
	...args: unknown[]
): Promise<void> {
	const redis = getRedisCache();
	const key = getCacheableKey(prefix, ...args);
	await redis.del(key);
}

/**
 * Invalidates all cacheable cache entries matching a pattern.
 * Uses Redis SCAN to safely iterate through matching keys.
 *
 * @param pattern - Redis pattern (use * for wildcards, e.g., "cacheable:flag:*")
 * @returns Number of keys deleted
 */
export async function invalidateCacheablePattern(
	pattern: string
): Promise<number> {
	const redis = getRedisCache();
	let deletedCount = 0;

	// Use SCAN with MATCH to find keys
	let cursor = "0";
	do {
		// SCAN returns [cursor, keys[]] in ioredis
		const [nextCursor, keys] = (await redis.scan(
			cursor,
			"MATCH",
			pattern,
			"COUNT",
			100
		)) as [string, string[]];
		cursor = nextCursor;

		if (keys.length > 0) {
			await redis.del(...keys);
			deletedCount += keys.length;
		}
	} while (cursor !== "0");

	return deletedCount;
}

/**
 * Invalidates all variations of a cacheable cache entry.
 * Useful when you want to invalidate a cache entry but don't know all possible argument values.
 *
 * @param prefix - The cache prefix (e.g., "flag", "flags-client")
 * @param knownArgs - Known arguments to include in the pattern
 * @returns Number of keys deleted
 *
 * @example
 * // Invalidate all flag caches for a specific key and clientId, regardless of environment
 * await invalidateCacheableWithArgs("flag", ["my-flag-key", "client-123"]);
 */
export async function invalidateCacheableWithArgs(
	prefix: string,
	knownArgs: unknown[]
): Promise<number> {
	const redis = getRedisCache();
	let deletedCount = 0;

	// Generate patterns for exact match and with trailing args
	const patterns: string[] = [];

	// Exact match: cacheable:prefix:[arg1,arg2]
	patterns.push(`cacheable:${prefix}:${stringify(knownArgs)}`);

	// With undefined trailing arg: cacheable:prefix:[arg1,arg2,undefined]
	patterns.push(`cacheable:${prefix}:${stringify([...knownArgs, undefined])}`);

	// With any trailing args: cacheable:prefix:[arg1,arg2,*
	patterns.push(`cacheable:${prefix}:${stringify(knownArgs).slice(0, -1)}*`);

	// Delete exact matches directly
	const exactKeys = patterns.slice(0, 2);
	for (const key of exactKeys) {
		const result = await redis.del(key);
		deletedCount += result;
	}

	// Use SCAN for wildcard pattern
	const wildcardPattern = patterns[2];
	let cursor = "0";
	do {
		const [nextCursor, keys] = (await redis.scan(
			cursor,
			"MATCH",
			wildcardPattern,
			"COUNT",
			100
		)) as [string, string[]];
		cursor = nextCursor;

		if (keys.length > 0) {
			await redis.del(...keys);
			deletedCount += keys.length;
		}
	} while (cursor !== "0");

	return deletedCount;
}

/**
 * Invalidates all cacheable cache entries with a specific prefix.
 *
 * @param prefix - The cache prefix (e.g., "flag", "flags-client")
 * @returns Number of keys deleted
 */
export function invalidateCacheablePrefix(prefix: string): Promise<number> {
	return invalidateCacheablePattern(`cacheable:${prefix}:*`);
}
