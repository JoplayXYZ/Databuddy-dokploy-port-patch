import Redis from "ioredis";

const URL = "redis://localhost:6379/1";

let instance: Redis | null = null;

export function redis() {
	if (!instance) {
		instance = new Redis(URL, {
			connectTimeout: 5000,
			commandTimeout: 3000,
			maxRetriesPerRequest: 1,
		});
		instance.on("error", () => {});
	}
	return instance;
}

export async function flushRedis() {
	await redis().flushdb();
}

export async function closeRedis() {
	if (instance) {
		await instance.quit();
		instance = null;
	}
}
