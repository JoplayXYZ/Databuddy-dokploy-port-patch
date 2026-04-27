import { afterEach, describe, expect, it } from "bun:test";
import {
	getBullMQConnectionOptions,
	getBullMQWorkerConnectionOptions,
} from "./bullmq";

const ORIGINAL_URL = process.env.BULLMQ_REDIS_URL;

afterEach(() => {
	process.env.BULLMQ_REDIS_URL = ORIGINAL_URL;
});

describe("BullMQ connection options", () => {
	it("requires BULLMQ_REDIS_URL", () => {
		delete process.env.BULLMQ_REDIS_URL;

		expect(() => getBullMQConnectionOptions()).toThrow(
			"BULLMQ_REDIS_URL environment variable is required"
		);
		expect(() => getBullMQWorkerConnectionOptions()).toThrow(
			"BULLMQ_REDIS_URL environment variable is required"
		);
	});

	it("parses redis URLs for queue producers", () => {
		process.env.BULLMQ_REDIS_URL = "redis://user:pass@example.test:6380/3";

		expect(getBullMQConnectionOptions()).toEqual({
			host: "example.test",
			port: 6380,
			username: "user",
			password: "pass",
			db: 3,
			maxRetriesPerRequest: 1,
		});
	});

	it("defaults to Redis port 6379 and omits empty auth fields", () => {
		process.env.BULLMQ_REDIS_URL = "redis://localhost";

		expect(getBullMQConnectionOptions()).toEqual({
			host: "localhost",
			port: 6379,
			username: undefined,
			password: undefined,
			db: undefined,
			maxRetriesPerRequest: 1,
		});
	});

	it("enables TLS for rediss URLs", () => {
		process.env.BULLMQ_REDIS_URL = "rediss://default:secret@redis.test:6379/2";

		expect(getBullMQConnectionOptions()).toEqual({
			host: "redis.test",
			port: 6379,
			username: "default",
			password: "secret",
			db: 2,
			tls: {},
			maxRetriesPerRequest: 1,
		});
	});

	it("uses persistent retry semantics for worker connections", () => {
		process.env.BULLMQ_REDIS_URL = "redis://localhost:6379";

		expect(getBullMQWorkerConnectionOptions()).toEqual({
			host: "localhost",
			port: 6379,
			username: undefined,
			password: undefined,
			db: undefined,
			maxRetriesPerRequest: null,
		});
	});
});
