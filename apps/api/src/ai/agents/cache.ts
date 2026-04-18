import { websitesApi } from "@databuddy/auth";
import { cacheable, getRedisCache } from "@databuddy/redis";
import { enrichAgentContext } from "../config/enrich-context";
import {
	getMemoryContext,
	isMemoryEnabled,
	type MemoryContext,
} from "../../lib/supermemory";
import { ensureAgentCreditsAvailable } from "./execution";

const PERM_TTL_SEC = 60;
const PERM_KEY_PREFIX = "cacheable:agent:perm:website-read";

const EMPTY_MEMORY: MemoryContext = {
	staticProfile: [],
	dynamicProfile: [],
	relevantMemories: [],
};

export const ensureAgentCreditsAvailableCached = cacheable(
	ensureAgentCreditsAvailable,
	{
		expireInSec: 30,
		prefix: "agent:credits",
		staleTime: 10,
		staleWhileRevalidate: true,
	}
);

export async function checkWebsiteReadPermissionCached(
	userId: string,
	organizationId: string,
	headers: Headers
): Promise<boolean> {
	const key = `${PERM_KEY_PREFIX}:${userId}:${organizationId}`;
	const redis = getRedisCache();
	try {
		const hit = await redis.get(key);
		if (hit === "1") {
			return true;
		}
		if (hit === "0") {
			return false;
		}
	} catch {
		// fall through to uncached check
	}
	const result = await websitesApi.hasPermission({
		headers,
		body: { organizationId, permissions: { website: ["read"] } },
	});
	try {
		await redis.setex(key, PERM_TTL_SEC, result.success ? "1" : "0");
	} catch {
		// best-effort cache write
	}
	return result.success;
}

const getMemoryContextInner = async (
	query: string,
	userId: string,
	websiteId: string
): Promise<MemoryContext> => {
	if (!(isMemoryEnabled() && query)) {
		return EMPTY_MEMORY;
	}
	const result = await getMemoryContext(query, userId, null, { websiteId });
	return result ?? EMPTY_MEMORY;
};

export const getMemoryContextCached = cacheable(getMemoryContextInner, {
	expireInSec: 60,
	prefix: "agent:memory",
	staleTime: 15,
	staleWhileRevalidate: true,
});

export const enrichAgentContextCached = cacheable(
	async (userId: string, websiteId: string, organizationId: string | null) =>
		enrichAgentContext({ userId, websiteId, organizationId }),
	{
		expireInSec: 120,
		prefix: "agent:enrich",
		staleTime: 30,
		staleWhileRevalidate: true,
	}
);
