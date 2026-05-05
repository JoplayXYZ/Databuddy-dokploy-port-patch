import { getRedisCache } from "@databuddy/redis";
import type {
	SlackAgentRun,
	SlackFollowUpMessage,
} from "../agent/agent-client";

const THREAD_LOCK_TTL_SECONDS = 5 * 60;
const FOLLOW_UP_QUEUE_TTL_SECONDS = THREAD_LOCK_TTL_SECONDS;
const ENGAGED_THREAD_TTL_SECONDS = 7 * 24 * 60 * 60;

interface RedisLike {
	del(...keys: string[]): Promise<number>;
	expire(key: string, seconds: number): Promise<number>;
	get(key: string): Promise<string | null>;
	lrange(key: string, start: number, stop: number): Promise<string[]>;
	ltrim(key: string, start: number, stop: number): Promise<unknown>;
	rpush(key: string, ...values: string[]): Promise<number>;
	set(
		key: string,
		value: string,
		exMode?: "EX",
		seconds?: number,
		nxMode?: "NX"
	): Promise<"OK" | null>;
}

function defaultRedis(): RedisLike | null {
	try {
		return getRedisCache() as unknown as RedisLike;
	} catch {
		return null;
	}
}

function threadIdentity(
	run: Pick<SlackAgentRun, "channelId" | "messageTs" | "teamId" | "threadTs">
): string {
	return [
		run.teamId ?? "team",
		run.channelId,
		run.threadTs ?? run.messageTs ?? "thread",
	].join(":");
}

const lockKey = (run: SlackAgentRun): string =>
	`slack:agent:thread-lock:${threadIdentity(run)}`;

const queueKey = (run: SlackAgentRun): string =>
	`slack:agent:followups:${threadIdentity(run)}`;

const engagedKey = (
	run: Pick<SlackAgentRun, "channelId" | "messageTs" | "teamId" | "threadTs">
): string => `slack:agent:engaged-thread:${threadIdentity(run)}`;

function parseQueuedFollowUp(raw: string): SlackFollowUpMessage | null {
	try {
		const parsed = JSON.parse(raw) as Partial<SlackFollowUpMessage>;
		if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
			return null;
		}
		return {
			...(typeof parsed.messageTs === "string"
				? { messageTs: parsed.messageTs }
				: {}),
			text: parsed.text,
			...(typeof parsed.userId === "string" ? { userId: parsed.userId } : {}),
		};
	} catch {
		return null;
	}
}

export class SlackThreadQueue {
	#redis: RedisLike | null | undefined;

	constructor(redis?: RedisLike | null) {
		this.#redis = redis;
	}

	#getRedis(): RedisLike | null {
		if (this.#redis !== undefined) {
			return this.#redis;
		}
		this.#redis = defaultRedis();
		return this.#redis;
	}

	async tryAcquire(run: SlackAgentRun): Promise<boolean> {
		const redis = this.#getRedis();
		if (!redis) {
			return true;
		}

		try {
			const result = await redis.set(
				lockKey(run),
				"1",
				"EX",
				THREAD_LOCK_TTL_SECONDS,
				"NX"
			);
			return result === "OK";
		} catch {
			return true;
		}
	}

	async release(run: SlackAgentRun): Promise<void> {
		await this.#getRedis()
			?.del(lockKey(run))
			.catch(() => undefined);
	}

	async enqueue(run: SlackAgentRun): Promise<boolean> {
		const redis = this.#getRedis();
		if (!redis) {
			return false;
		}

		const text = run.text.trim();
		if (!text) {
			return false;
		}

		const item: SlackFollowUpMessage = {
			...(run.messageTs ? { messageTs: run.messageTs } : {}),
			text,
			userId: run.userId,
		};
		try {
			const key = queueKey(run);
			await redis.rpush(key, JSON.stringify(item));
			await redis.expire(key, FOLLOW_UP_QUEUE_TTL_SECONDS);
			return true;
		} catch {
			return false;
		}
	}

	async drain(run: SlackAgentRun): Promise<SlackFollowUpMessage[]> {
		const redis = this.#getRedis();
		if (!redis) {
			return [];
		}

		try {
			const key = queueKey(run);
			const items = await redis.lrange(key, 0, -1);
			if (items.length > 0) {
				await redis.ltrim(key, items.length, -1);
			}

			return items
				.map(parseQueuedFollowUp)
				.filter((item): item is SlackFollowUpMessage => item !== null);
		} catch {
			return [];
		}
	}

	async markEngaged(run: SlackAgentRun): Promise<void> {
		await this.#getRedis()
			?.set(engagedKey(run), "1", "EX", ENGAGED_THREAD_TTL_SECONDS)
			.catch(() => undefined);
	}

	async isEngaged(
		run: Pick<SlackAgentRun, "channelId" | "messageTs" | "teamId" | "threadTs">
	): Promise<boolean> {
		const redis = this.#getRedis();
		if (!redis) {
			return false;
		}
		try {
			return (await redis.get(engagedKey(run))) === "1";
		} catch {
			return false;
		}
	}
}

export const slackThreadQueue = new SlackThreadQueue();
