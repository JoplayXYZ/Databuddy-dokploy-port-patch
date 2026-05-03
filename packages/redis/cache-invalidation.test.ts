import { beforeEach, describe, expect, it, mock } from "bun:test";

interface RedisEntry {
	ttl: number;
	value: string;
}

const redisStore = new Map<string, RedisEntry>();
let failGet = false;

function matchesRedisPattern(pattern: string, key: string): boolean {
	const escaped = pattern
		.split("*")
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${escaped}$`).test(key);
}

const mockRedisClient = {
	del: mock(async (...keys: string[]) => {
		let count = 0;
		for (const key of keys) {
			if (redisStore.delete(key)) {
				count += 1;
			}
		}
		return count;
	}),
	get: mock(async (key: string) => {
		if (failGet) {
			throw new Error("redis get failed");
		}
		return redisStore.get(key)?.value ?? null;
	}),
	scan: mock(
		async (
			_cursor: string,
			_match: "MATCH",
			pattern: string,
			_count: "COUNT",
			_limit: number
		) => [
			"0",
			Array.from(redisStore.keys()).filter((key) =>
				matchesRedisPattern(pattern, key)
			),
		]
	),
	set: mock(async (key: string, value: string) => {
		redisStore.set(key, { value, ttl: -1 });
		return "OK";
	}),
	setex: mock(async (key: string, ttl: number, value: string) => {
		redisStore.set(key, { value, ttl });
		return "OK";
	}),
	ttl: mock(async (key: string) => redisStore.get(key)?.ttl ?? -2),
};

mock.module("./redis", () => ({
	getRedisCache: () => mockRedisClient,
}));

const {
	getAgentContextSnapshotKey,
	invalidateAgentContextSnapshot,
	invalidateAgentContextSnapshotsForOwner,
	invalidateAgentContextSnapshotsForWebsite,
} = await import("./cache-invalidation");

const freshSnapshot = (context: string) =>
	JSON.stringify({
		context,
		refreshedAt: "2026-05-03T10:00:00.000Z",
	});

const readSnapshot = (key: string) =>
	JSON.parse(redisStore.get(key)?.value ?? "{}") as {
		context?: string;
		refreshedAt?: string;
	};

beforeEach(() => {
	redisStore.clear();
	failGet = false;
	mockRedisClient.del.mockClear();
	mockRedisClient.get.mockClear();
	mockRedisClient.scan.mockClear();
	mockRedisClient.set.mockClear();
	mockRedisClient.setex.mockClear();
	mockRedisClient.ttl.mockClear();
});

describe("agent context snapshot keys", () => {
	it("uses the organization as owner when available", () => {
		expect(getAgentContextSnapshotKey("user-1", "site-1", "org-1")).toBe(
			"agent:context-snapshot:org-1:site-1"
		);
	});

	it("falls back to the user id for personal workspaces", () => {
		expect(getAgentContextSnapshotKey("user-1", "site-1", null)).toBe(
			"agent:context-snapshot:user-1:site-1"
		);
	});
});

describe("agent context snapshot invalidation", () => {
	it("marks an exact snapshot stale while preserving context and TTL", async () => {
		const key = getAgentContextSnapshotKey("user-1", "site-1", "org-1");
		redisStore.set(key, { value: freshSnapshot("cached context"), ttl: 1234 });

		await invalidateAgentContextSnapshot("user-1", "site-1", "org-1");

		expect(readSnapshot(key)).toEqual({
			context: "cached context",
			refreshedAt: "1970-01-01T00:00:00.000Z",
		});
		expect(redisStore.get(key)?.ttl).toBe(1234);
	});

	it("marks every owner snapshot for a website stale", async () => {
		const orgKey = getAgentContextSnapshotKey("user-1", "site-1", "org-1");
		const userKey = getAgentContextSnapshotKey("user-2", "site-1", null);
		const otherSiteKey = getAgentContextSnapshotKey("user-1", "site-2", "org-1");
		redisStore.set(orgKey, { value: freshSnapshot("org site one"), ttl: 100 });
		redisStore.set(userKey, { value: freshSnapshot("user site one"), ttl: 100 });
		redisStore.set(otherSiteKey, {
			value: freshSnapshot("org site two"),
			ttl: 100,
		});

		const count = await invalidateAgentContextSnapshotsForWebsite("site-1");

		expect(count).toBe(2);
		expect(readSnapshot(orgKey).refreshedAt).toBe("1970-01-01T00:00:00.000Z");
		expect(readSnapshot(userKey).refreshedAt).toBe("1970-01-01T00:00:00.000Z");
		expect(readSnapshot(otherSiteKey).refreshedAt).toBe(
			"2026-05-03T10:00:00.000Z"
		);
	});

	it("marks every website snapshot for an owner stale", async () => {
		const firstKey = getAgentContextSnapshotKey("user-1", "site-1", "org-1");
		const secondKey = getAgentContextSnapshotKey("user-1", "site-2", "org-1");
		const otherOwnerKey = getAgentContextSnapshotKey("user-2", "site-1", null);
		redisStore.set(firstKey, { value: freshSnapshot("first"), ttl: 100 });
		redisStore.set(secondKey, { value: freshSnapshot("second"), ttl: 100 });
		redisStore.set(otherOwnerKey, { value: freshSnapshot("other"), ttl: 100 });

		const count = await invalidateAgentContextSnapshotsForOwner("org-1");

		expect(count).toBe(2);
		expect(readSnapshot(firstKey).refreshedAt).toBe(
			"1970-01-01T00:00:00.000Z"
		);
		expect(readSnapshot(secondKey).refreshedAt).toBe(
			"1970-01-01T00:00:00.000Z"
		);
		expect(readSnapshot(otherOwnerKey).refreshedAt).toBe(
			"2026-05-03T10:00:00.000Z"
		);
	});

	it("deletes corrupt snapshots instead of preserving invalid payloads", async () => {
		const key = getAgentContextSnapshotKey("user-1", "site-1", "org-1");
		redisStore.set(key, { value: "not-json", ttl: 100 });

		const count = await invalidateAgentContextSnapshotsForWebsite("site-1");

		expect(count).toBe(1);
		expect(redisStore.has(key)).toBe(false);
	});

	it("treats Redis failures as best-effort cache misses", async () => {
		const key = getAgentContextSnapshotKey("user-1", "site-1", "org-1");
		redisStore.set(key, { value: freshSnapshot("cached"), ttl: 100 });
		failGet = true;

		await expect(
			invalidateAgentContextSnapshot("user-1", "site-1", "org-1")
		).resolves.toBeUndefined();
		await expect(
			invalidateAgentContextSnapshotsForWebsite("site-1")
		).resolves.toBe(0);
	});
});
