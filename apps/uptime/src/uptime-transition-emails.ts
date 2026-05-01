import { and, db, eq, withTransaction } from "@databuddy/db";
import { alarms, uptimeSchedules } from "@databuddy/db/schema";
import { chQuery } from "@databuddy/db/clickhouse";
import {
	NotificationClient,
	type NotificationChannel,
} from "@databuddy/notifications";
import { Data, Effect } from "effect";
import type { ScheduleData } from "./actions";
import { UPTIME_ENV } from "./lib/env";
import { captureError } from "./lib/tracing";
import { MonitorStatus, type UptimeData } from "./types";

const TRAILING_SLASH = /\/$/;

class TransitionClaimError extends Data.TaggedError("TransitionClaimError")<{
	cause: unknown;
}> {}

class AlarmLookupError extends Data.TaggedError("AlarmLookupError")<{
	cause: unknown;
}> {}

class NotificationSendError extends Data.TaggedError(
	"NotificationSendError",
)<{
	alarmId: string;
	cause: unknown;
}> {}

class ClickHouseQueryError extends Data.TaggedError("ClickHouseQueryError")<{
	cause: unknown;
}> {}

function toNotificationConfig(
	destinations: Array<{ type: string; identifier: string; config: unknown }>,
) {
	const clientConfig: Record<string, Record<string, unknown>> = {};
	const channels: NotificationChannel[] = [];

	for (const dest of destinations) {
		const cfg = (dest.config ?? {}) as Record<string, unknown>;
		if (dest.type === "slack") {
			clientConfig.slack = { webhookUrl: dest.identifier };
			channels.push("slack");
		} else if (dest.type === "webhook") {
			clientConfig.webhook = {
				url: dest.identifier,
				headers: cfg.headers as Record<string, string> | undefined,
			};
			channels.push("webhook");
		}
	}

	return { clientConfig, channels };
}

function buildSiteLabel(schedule: ScheduleData): string {
	const w = schedule.website;
	if (w?.name) return w.name;
	if (w?.domain) return w.domain;
	if (schedule.name) return schedule.name;
	try {
		return new URL(schedule.url).hostname;
	} catch {
		return schedule.url;
	}
}

export function resolveTransitionKind(
	previous: number | undefined,
	current: number,
): "down" | "recovered" | null {
	if (current === MonitorStatus.UP) {
		if (previous === MonitorStatus.DOWN) return "recovered";
		return null;
	}
	if (current === MonitorStatus.DOWN) {
		if (previous === MonitorStatus.DOWN) return null;
		return "down";
	}
	return null;
}

const claimTransition = (scheduleId: string, currentStatus: number) =>
	Effect.tryPromise({
		try: () =>
			withTransaction(async (tx) => {
				const [row] = await tx
					.select({ last: uptimeSchedules.lastNotifiedStatus })
					.from(uptimeSchedules)
					.where(eq(uptimeSchedules.id, scheduleId))
					.for("update");

				if (!row) return null;

				const kind = resolveTransitionKind(
					row.last ?? undefined,
					currentStatus,
				);
				if (kind === null) return null;

				await tx
					.update(uptimeSchedules)
					.set({ lastNotifiedStatus: currentStatus })
					.where(eq(uptimeSchedules.id, scheduleId));

				return kind;
			}),
		catch: (cause) => new TransitionClaimError({ cause }),
	});

const ALARM_CACHE_TTL = 30_000;
const alarmCache = new Map<
	string,
	{ ts: number; data: Awaited<ReturnType<typeof fetchLinkedAlarmsRaw>> }
>();

async function fetchLinkedAlarmsRaw(
	scheduleId: string,
	organizationId: string,
) {
	const rows = await db.query.alarms.findMany({
		where: and(
			eq(alarms.organizationId, organizationId),
			eq(alarms.enabled, true),
		),
		with: { destinations: true },
	});

	return rows.filter((alarm) => {
		const tc = alarm.triggerConditions as Record<string, unknown> | null;
		return (
			tc &&
			Array.isArray(tc.monitorIds) &&
			(tc.monitorIds as string[]).includes(scheduleId)
		);
	});
}

const getLinkedAlarms = (scheduleId: string, organizationId: string) =>
	Effect.tryPromise({
		try: async () => {
			const key = `${organizationId}:${scheduleId}`;
			const cached = alarmCache.get(key);
			if (cached && Date.now() - cached.ts < ALARM_CACHE_TTL) {
				return cached.data;
			}
			const data = await fetchLinkedAlarmsRaw(scheduleId, organizationId);
			alarmCache.set(key, { ts: Date.now(), data });
			return data;
		},
		catch: (cause) => new AlarmLookupError({ cause }),
	});

const sendAlarmNotification = (
	alarm: { id: string; destinations: Array<{ type: string; identifier: string; config: unknown }> },
	payload: Parameters<NotificationClient["send"]>[0],
) =>
	Effect.tryPromise({
		try: () => {
			const { clientConfig, channels } = toNotificationConfig(
				alarm.destinations,
			);
			if (channels.length === 0) return Promise.resolve(false);
			return new NotificationClient(clientConfig)
				.send(payload, { channels })
				.then(() => true);
		},
		catch: (cause) => new NotificationSendError({ alarmId: alarm.id, cause }),
	});

const queryPreviousStatus = (siteId: string) => {
	if (!process.env.CLICKHOUSE_URL) {
		return Effect.succeed(undefined as number | undefined);
	}

	return Effect.tryPromise({
		try: async () => {
			const rows = await chQuery<{ status: number }>(
				`SELECT status
       FROM uptime.uptime_monitor
       WHERE site_id = {siteId:String}
       ORDER BY timestamp DESC
       LIMIT 1`,
				{ siteId },
			);
			return rows[0]?.status;
		},
		catch: (cause) => new ClickHouseQueryError({ cause }),
	});
};

export async function getPreviousMonitorStatus(
	siteId: string,
): Promise<number | undefined> {
	return Effect.runPromise(
		queryPreviousStatus(siteId).pipe(
			Effect.catchTag("ClickHouseQueryError", (e) => {
				captureError(e.cause, { error_step: "clickhouse_previous_status" });
				return Effect.succeed(undefined as number | undefined);
			}),
		),
	);
}

export interface TransitionResult {
	alarms_fired: number;
	transition_kind: "down" | "recovered" | null;
}

const noTransition: TransitionResult = {
	alarms_fired: 0,
	transition_kind: null,
};

const processTransition = (options: {
	schedule: ScheduleData;
	data: UptimeData;
	previousStatus?: number;
}) =>
	Effect.gen(function* () {
		if (!UPTIME_ENV.isProduction) return noTransition;

		if (
			options.previousStatus !== undefined &&
			resolveTransitionKind(options.previousStatus, options.data.status) ===
				null
		) {
			return noTransition;
		}

		const kind = yield* claimTransition(
			options.schedule.id,
			options.data.status,
		).pipe(
			Effect.catchTag("TransitionClaimError", (e) => {
				captureError(e.cause, { error_step: "transition_claim" });
				return Effect.succeed(null);
			}),
		);

		if (kind === null) return noTransition;

		const linkedAlarms = yield* getLinkedAlarms(
			options.schedule.id,
			options.schedule.organizationId,
		).pipe(
			Effect.catchTag("AlarmLookupError", (e) => {
				captureError(e.cause, { error_step: "alarm_lookup" });
				return Effect.succeed([] as Awaited<ReturnType<typeof fetchLinkedAlarmsRaw>>);
			}),
		);

		if (linkedAlarms.length === 0) {
			return { alarms_fired: 0, transition_kind: kind };
		}

		const siteLabel = buildSiteLabel(options.schedule);
		const baseUrl =
			process.env.DASHBOARD_APP_URL ?? "https://app.databuddy.cc";
		const dashboardUrl = `${baseUrl.replace(TRAILING_SLASH, "")}/monitors/${options.schedule.id}`;

		const httpInfo = options.data.http_code
			? ` (HTTP ${options.data.http_code})`
			: "";
		const errorInfo = options.data.error
			? ` - ${options.data.error}`
			: "";

		const payload = {
			title:
				kind === "down"
					? `[DOWN] ${siteLabel} is unreachable`
					: `[Recovered] ${siteLabel} is back up`,
			message:
				kind === "down"
					? `${siteLabel} is down${httpInfo}${errorInfo}. View details: ${dashboardUrl}`
					: `${siteLabel} has recovered and is operational again. Response time: ${options.data.total_ms}ms. View details: ${dashboardUrl}`,
			priority: kind === "down" ? ("high" as const) : ("normal" as const),
			metadata: {
				template: "uptime-transition" as const,
				monitorId: options.schedule.id,
				monitorName: siteLabel,
				url: options.data.url,
				kind,
				httpCode: options.data.http_code,
				dashboardUrl,
			},
		};

		const sendable = linkedAlarms.filter(
			(a) => a.destinations && a.destinations.length > 0,
		);

		const results = yield* Effect.all(
			sendable.map((alarm) =>
				sendAlarmNotification(alarm, payload).pipe(
					Effect.catchTag("NotificationSendError", (e) => {
						captureError(e.cause, {
							error_step: "alarm_notification",
							alarm_id: e.alarmId,
						});
						return Effect.succeed(false);
					}),
				),
			),
			{ concurrency: "unbounded" },
		);

		const fired = results.filter((sent) => sent === true).length;

		return { alarms_fired: fired, transition_kind: kind } as TransitionResult;
	});

export async function sendUptimeTransitionEmailsIfNeeded(options: {
	schedule: ScheduleData;
	data: UptimeData;
	previousStatus?: number;
}): Promise<TransitionResult> {
	return Effect.runPromise(processTransition(options));
}
