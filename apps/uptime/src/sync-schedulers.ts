import { db, eq } from "@databuddy/db";
import { uptimeSchedules } from "@databuddy/db/schema";
import {
	getUptimeQueue,
	UPTIME_CHECK_JOB_NAME,
	UPTIME_JOB_OPTIONS,
	uptimeSchedulerId,
} from "@databuddy/redis";
import { log } from "evlog";

const CRON_GRANULARITIES: Record<string, string> = {
	minute: "* * * * *",
	five_minutes: "*/5 * * * *",
	ten_minutes: "*/10 * * * *",
	thirty_minutes: "*/30 * * * *",
	hour: "0 * * * *",
	six_hours: "0 */6 * * *",
	twelve_hours: "0 */12 * * *",
	day: "0 0 * * *",
};

export async function syncSchedulers(): Promise<void> {
	const queue = getUptimeQueue();

	const monitors = await db
		.select({
			id: uptimeSchedules.id,
			granularity: uptimeSchedules.granularity,
		})
		.from(uptimeSchedules)
		.where(eq(uptimeSchedules.isPaused, false));

	let created = 0;
	let skipped = 0;
	let failed = 0;

	for (const monitor of monitors) {
		try {
			const schedulerId = uptimeSchedulerId(monitor.id);
			const existing = await queue.getJobScheduler(schedulerId);
			if (existing) {
				skipped++;
				continue;
			}

			const pattern = CRON_GRANULARITIES[monitor.granularity];
			if (!pattern) {
				failed++;
				log.error({
					sync: "scheduler",
					schedule_id: monitor.id,
					error_message: `Unknown granularity: ${monitor.granularity}`,
				});
				continue;
			}

			await queue.upsertJobScheduler(
				schedulerId,
				{ pattern },
				{
					name: UPTIME_CHECK_JOB_NAME,
					data: { scheduleId: monitor.id, trigger: "scheduled" as const },
					opts: UPTIME_JOB_OPTIONS,
				}
			);
			created++;
		} catch (error) {
			failed++;
			log.error({
				sync: "scheduler",
				schedule_id: monitor.id,
				error_message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	log.info({
		sync: "scheduler",
		total: monitors.length,
		created,
		skipped,
		failed,
	});
}
