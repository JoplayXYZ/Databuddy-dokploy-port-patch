import { Queue } from "bullmq";
import { getBullMQConnectionOptions } from "./bullmq";

export const UPTIME_QUEUE_NAME = "uptime-checks";
export const UPTIME_CHECK_JOB_NAME = "uptime-check";

export const UPTIME_JOB_TIMEOUT_MS = 30_000;

export const UPTIME_JOB_OPTIONS = {
	attempts: 3,
	backoff: {
		type: "exponential",
		delay: 2000,
	},
	removeOnComplete: {
		age: 24 * 3600,
		count: 1000,
	},
	removeOnFail: {
		age: 7 * 24 * 3600,
		count: 5000,
	},
};

export interface UptimeCheckJobData {
	scheduleId: string;
	trigger: "manual" | "scheduled";
}

let uptimeQueue: Queue<UptimeCheckJobData> | null = null;

export function getUptimeQueue(): Queue<UptimeCheckJobData> {
	uptimeQueue ??= new Queue<UptimeCheckJobData>(UPTIME_QUEUE_NAME, {
		connection: getBullMQConnectionOptions(),
		defaultJobOptions: UPTIME_JOB_OPTIONS,
	});

	return uptimeQueue;
}

export async function closeUptimeQueue(): Promise<void> {
	if (!uptimeQueue) {
		return;
	}
	const queue = uptimeQueue;
	uptimeQueue = null;
	await queue.close();
}

export function uptimeSchedulerId(scheduleId: string): string {
	return `uptime-${scheduleId}`;
}

export function uptimeImmediateJobId(scheduleId: string): string {
	return `uptime-manual-${scheduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
