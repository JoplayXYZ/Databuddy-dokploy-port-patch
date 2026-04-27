import type { RedisOptions } from "ioredis";

function parseBullMQConnectionUrl(): RedisOptions {
	const redisUrl = process.env.BULLMQ_REDIS_URL;
	if (!redisUrl) {
		throw new Error("BULLMQ_REDIS_URL environment variable is required");
	}

	const url = new URL(redisUrl);

	return {
		host: url.hostname,
		port: Number(url.port) || 6379,
		username: url.username || undefined,
		password: url.password || undefined,
		db: url.pathname ? Number(url.pathname.slice(1)) : undefined,
		...(url.protocol === "rediss:" ? { tls: {} } : {}),
	};
}

export function getBullMQConnectionOptions(): RedisOptions {
	return {
		...parseBullMQConnectionUrl(),
		maxRetriesPerRequest: 1,
	};
}

export function getBullMQWorkerConnectionOptions(): RedisOptions {
	return {
		...parseBullMQConnectionUrl(),
		maxRetriesPerRequest: null,
	};
}
