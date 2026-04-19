import Redis from "ioredis";

let redisInstance: Redis | null = null;

export async function shutdownRedis() {
	if (!redisInstance) {
		return;
	}
	const instance = redisInstance;
	redisInstance = null;
	try {
		await instance.quit();
	} catch {
		instance.disconnect();
	}
}

export function getRedisCache() {
	if (redisInstance) {
		return redisInstance;
	}

	const url = process.env.REDIS_URL;
	if (!url) {
		throw new Error("REDIS_URL environment variable is required");
	}

	redisInstance = new Redis(url, {
		connectTimeout: 10_000,
		commandTimeout: 5000,
		retryStrategy: (times) => {
			if (times > 20) {
				return null;
			}
			return Math.min(times * 100, 3000);
		},
		maxRetriesPerRequest: 3,
	});

	redisInstance.on("error", () => {});
	process.on("SIGTERM", shutdownRedis);
	process.on("SIGINT", shutdownRedis);

	return redisInstance;
}

export const redis = new Proxy({} as Redis, {
	get(_, prop) {
		return Reflect.get(getRedisCache(), prop);
	},
});
