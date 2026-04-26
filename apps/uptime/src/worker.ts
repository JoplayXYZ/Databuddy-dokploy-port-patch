import {
	getBullMQWorkerConnectionOptions,
	type UptimeCheckJobData,
	UPTIME_CHECK_JOB_NAME,
	UPTIME_QUEUE_NAME,
} from "@databuddy/redis";
import { Worker } from "bullmq";
import { log } from "evlog";
import { type CheckOptions, checkUptime, lookupSchedule } from "./actions";
import type { ScheduleData } from "./actions";
import { isHealthExtractionEnabled } from "./json-parser";
import { sendUptimeEvent } from "./lib/producer";
import { captureError, mergeWideEvent } from "./lib/tracing";
import type { ActionResult, UptimeData } from "./types";
import {
	getPreviousMonitorStatus,
	sendUptimeTransitionEmailsIfNeeded,
} from "./uptime-transition-emails";

export interface UptimeWorkerDeps {
	captureError: (
		error: unknown,
		attributes?: Record<string, string | number | boolean>
	) => void;
	checkUptime: (
		siteId: string,
		url: string,
		attempt: number,
		retries: number,
		options: CheckOptions
	) => Promise<ActionResult<UptimeData>>;
	getPreviousMonitorStatus: (monitorId: string) => Promise<number | undefined>;
	isHealthExtractionEnabled: (config: unknown) => boolean;
	lookupSchedule: (scheduleId: string) => Promise<ActionResult<ScheduleData>>;
	mergeWideEvent: (fields: Record<string, string | number | boolean>) => void;
	sendUptimeEvent: (data: UptimeData, monitorId: string) => Promise<void>;
	sendUptimeTransitionEmailsIfNeeded: (options: {
		schedule: ScheduleData;
		data: UptimeData;
	}) => Promise<void>;
}

const uptimeWorkerDeps: UptimeWorkerDeps = {
	captureError,
	checkUptime,
	getPreviousMonitorStatus,
	isHealthExtractionEnabled,
	lookupSchedule,
	mergeWideEvent,
	sendUptimeEvent,
	sendUptimeTransitionEmailsIfNeeded,
};

export interface UptimeWorkerJob {
	data: UptimeCheckJobData;
	name: string;
}

export async function processUptimeCheck(
	scheduleId: string,
	trigger: UptimeCheckJobData["trigger"],
	deps: UptimeWorkerDeps = uptimeWorkerDeps
) {
	const schedule = await deps.lookupSchedule(scheduleId);
	if (!schedule.success) {
		deps.captureError(new Error(schedule.error), {
			error_step: "schedule_not_found",
			schedule_id: scheduleId,
		});
		return;
	}

	if (schedule.data.isPaused) {
		deps.mergeWideEvent({
			schedule_id: scheduleId,
			organization_id: schedule.data.organizationId,
			uptime_skipped_paused: true,
		});
		return;
	}

	const monitorId = schedule.data.websiteId || scheduleId;

	deps.mergeWideEvent({
		schedule_id: scheduleId,
		monitor_id: monitorId,
		organization_id: schedule.data.organizationId,
		uptime_trigger: trigger,
		...(schedule.data.websiteId ? { website_id: schedule.data.websiteId } : {}),
	});

	const options: CheckOptions = {
		timeout: schedule.data.timeout ?? undefined,
		cacheBust: schedule.data.cacheBust,
		extractHealth: deps.isHealthExtractionEnabled(
			schedule.data.jsonParsingConfig
		),
	};

	const result = await deps.checkUptime(
		monitorId,
		schedule.data.url,
		1,
		3,
		options
	);

	if (!result.success) {
		deps.captureError(new Error(result.error), {
			error_step: "uptime_check_failed",
			monitor_id: monitorId,
			check_url: schedule.data.url,
		});
		throw new Error(result.error);
	}

	const previousStatus = await deps.getPreviousMonitorStatus(monitorId);

	deps.mergeWideEvent({
		previous_uptime_status: previousStatus === undefined ? -1 : previousStatus,
	});

	try {
		await deps.sendUptimeEvent(result.data, monitorId);
		await deps.sendUptimeTransitionEmailsIfNeeded({
			schedule: schedule.data,
			data: result.data,
		});
	} catch (error) {
		deps.captureError(error, {
			error_step: "producer_pipeline",
			monitor_id: monitorId,
			http_code: result.data.http_code,
		});
	}
}

export async function processUptimeJob(
	job: UptimeWorkerJob,
	deps: UptimeWorkerDeps = uptimeWorkerDeps
) {
	if (job.name !== UPTIME_CHECK_JOB_NAME) {
		throw new Error(`Unknown uptime job: ${job.name}`);
	}
	await processUptimeCheck(job.data.scheduleId, job.data.trigger, deps);
}

export function startUptimeWorker() {
	const worker = new Worker<UptimeCheckJobData>(
		UPTIME_QUEUE_NAME,
		(job) => processUptimeJob(job),
		{
			connection: getBullMQWorkerConnectionOptions(),
			concurrency: Number(process.env.UPTIME_WORKER_CONCURRENCY ?? 5),
		}
	);

	worker.on("completed", (job) => {
		log.info({
			job_id: job.id,
			schedule_id: job.data.scheduleId,
			trigger: job.data.trigger,
			worker: "uptime",
			event: "job_completed",
		});
	});

	worker.on("failed", (job, error) => {
		captureError(error, {
			error_step: "uptime_worker_job_failed",
			schedule_id: job?.data.scheduleId ?? "",
		});
	});

	return worker;
}
