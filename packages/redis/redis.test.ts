import { describe, expect, it, mock } from "bun:test";

let capturedUrl: string | undefined;
let capturedOptions: Record<string, unknown> | undefined;

class MockRedis {
	constructor(url: string, options: Record<string, unknown>) {
		capturedUrl = url;
		capturedOptions = options;
	}

	on() {
		return this;
	}

	async quit() {}
	disconnect() {}
}

mock.module("ioredis", () => ({
	default: MockRedis,
}));

process.env.REDIS_URL = "redis://test-host:6379";

const { getRedisCache } = await import("./redis");
getRedisCache();

describe("redis", () => {
	describe("constructor options", () => {
		it("passes REDIS_URL to the Redis constructor", () => {
			expect(capturedUrl).toBe("redis://test-host:6379");
		});

		it("sets connectTimeout to 10 seconds", () => {
			expect(capturedOptions?.connectTimeout).toBe(10_000);
		});

		it("sets commandTimeout to 5 seconds", () => {
			expect(capturedOptions?.commandTimeout).toBe(5000);
		});

		it("sets maxRetriesPerRequest to 3", () => {
			expect(capturedOptions?.maxRetriesPerRequest).toBe(3);
		});
	});

	describe("retry strategy", () => {
		const strategy = capturedOptions?.retryStrategy as (
			times: number
		) => number | null;

		it("returns 100ms on first retry", () => {
			expect(strategy(1)).toBe(100);
		});

		it("scales linearly at 100ms per attempt", () => {
			expect(strategy(5)).toBe(500);
			expect(strategy(10)).toBe(1000);
			expect(strategy(20)).toBe(2000);
		});

		it("returns null after 20 attempts", () => {
			expect(strategy(21)).toBeNull();
			expect(strategy(50)).toBeNull();
		});
	});

	describe("singleton behavior", () => {
		it("returns the same instance on repeated calls", () => {
			expect(getRedisCache()).toBe(getRedisCache());
		});
	});

	describe("shutdown behavior", () => {
		it("registers SIGTERM and SIGINT handlers", () => {
			expect(process.listenerCount("SIGTERM")).toBeGreaterThanOrEqual(1);
			expect(process.listenerCount("SIGINT")).toBeGreaterThanOrEqual(1);
		});
	});
});
