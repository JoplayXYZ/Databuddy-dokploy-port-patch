import { describe, expect, it } from "bun:test";
import type { SlackAgentRun } from "../agent/agent-client";
import { SlackThreadQueue } from "./thread-queue";

function createRun(overrides: Partial<SlackAgentRun> = {}): SlackAgentRun {
	return {
		channelId: "C123",
		messageTs: "171234.567",
		teamId: "T123",
		text: "What changed?",
		threadTs: "171234.000",
		trigger: "app_mention",
		userId: "U123",
		...overrides,
	};
}

function createFakeRedis() {
	const values = new Map<string, string>();
	const lists = new Map<string, string[]>();
	const expiries = new Map<string, number>();

	return {
		values,
		lists,
		expiries,
		async del(...keys: string[]) {
			let deleted = 0;
			for (const key of keys) {
				if (values.delete(key)) {
					deleted++;
				}
				lists.delete(key);
				expiries.delete(key);
			}
			return deleted;
		},
		async expire(key: string, seconds: number) {
			expiries.set(key, seconds);
			return 1;
		},
		async get(key: string) {
			return values.get(key) ?? null;
		},
		async lrange(key: string) {
			return [...(lists.get(key) ?? [])];
		},
		async ltrim(key: string, start: number, stop: number) {
			const list = lists.get(key) ?? [];
			lists.set(key, list.slice(start, stop === -1 ? undefined : stop + 1));
			return "OK";
		},
		async rpush(key: string, ...items: string[]) {
			const list = lists.get(key) ?? [];
			list.push(...items);
			lists.set(key, list);
			return list.length;
		},
		async set(
			key: string,
			value: string,
			exMode?: "EX",
			seconds?: number,
			nxMode?: "NX"
		) {
			if (nxMode === "NX" && values.has(key)) {
				return null;
			}
			values.set(key, value);
			if (exMode === "EX" && typeof seconds === "number") {
				expiries.set(key, seconds);
			}
			return "OK" as const;
		},
	};
}

describe("SlackThreadQueue", () => {
	it("allows only one active run per Slack thread", async () => {
		const redis = createFakeRedis();
		const queue = new SlackThreadQueue(redis);
		const run = createRun();

		expect(await queue.tryAcquire(run)).toBe(true);
		expect(await queue.tryAcquire(run)).toBe(false);

		await queue.release(run);
		expect(await queue.tryAcquire(run)).toBe(true);
	});

	it("queues and drains follow-up messages for a thread", async () => {
		const redis = createFakeRedis();
		const queue = new SlackThreadQueue(redis);
		const run = createRun();

		await queue.enqueue(createRun({ messageTs: "171234.568", text: "also referrers" }));
		await queue.enqueue(createRun({ messageTs: "171234.569", text: "and campaigns" }));

		expect(await queue.drain(run)).toEqual([
			{ messageTs: "171234.568", text: "also referrers", userId: "U123" },
			{ messageTs: "171234.569", text: "and campaigns", userId: "U123" },
		]);
		expect(await queue.drain(run)).toEqual([]);
	});

	it("tracks threads Databuddy has already joined", async () => {
		const redis = createFakeRedis();
		const queue = new SlackThreadQueue(redis);
		const run = createRun();

		expect(await queue.isEngaged(run)).toBe(false);
		await queue.markEngaged(run);
		expect(await queue.isEngaged(run)).toBe(true);
	});
});
