import { and, db, eq, sql, withTransaction } from "@databuddy/db";
import { alarms, uptimeSchedules } from "@databuddy/db/schema";
import { chQuery } from "@databuddy/db/clickhouse";
import {
	NotificationClient,
	type NotificationChannel,
} from "@databuddy/notifications";
import type { ScheduleData } from "./actions";
import { UPTIME_ENV } from "./lib/env";
import { captureError } from "./lib/tracing";
import { MonitorStatus, type UptimeData } from "./types";

const TRAILING_SLASH = /\/$/;

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
	if (w?.name) {
		return w.name;
	}
	if (w?.domain) {
		return w.domain;
	}
	if (schedule.name) {
		return schedule.name;
	}
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
		if (previous === MonitorStatus.DOWN) {
			return "recovered";
		}
		return null;
	}
	if (current === MonitorStatus.DOWN) {
		if (previous === MonitorStatus.DOWN) {
			return null;
		}
		return "down";
	}
	return null;
}

async function claimTransition(
	scheduleId: string,
	currentStatus: number,
): Promise<"down" | "recovered" | null> {
	try {
		return await withTransaction(async (tx) => {
			const [row] = await tx
				.select({ last: uptimeSchedules.lastNotifiedStatus })
				.from(uptimeSchedules)
				.where(eq(uptimeSchedules.id, scheduleId))
				.for("update");

			if (!row) {
				return null;
			}

			const kind = resolveTransitionKind(row.last ?? undefined, currentStatus);
			if (kind === null) {
				return null;
			}

			await tx
				.update(uptimeSchedules)
				.set({ lastNotifiedStatus: currentStatus })
				.where(eq(uptimeSchedules.id, scheduleId));

			return kind;
		});
	} catch (error) {
		captureError(error, { error_step: "transition_claim" });
		return null;
	}
}

const ALARM_CACHE_TTL = 30_000;
const alarmCache = new Map<
	string,
	{ ts: number; data: Awaited<ReturnType<typeof fetchLinkedAlarms>> }
>();

async function fetchLinkedAlarms(
	scheduleId: string,
	organizationId: string,
) {
	return db.query.alarms.findMany({
		where: and(
			eq(alarms.organizationId, organizationId),
			eq(alarms.enabled, true),
			sql`${alarms.triggerConditions}->'monitorIds' @> ${JSON.stringify([scheduleId])}::jsonb`,
		),
		with: { destinations: true },
	});
}

async function getLinkedAlarms(scheduleId: string, organizationId: string) {
	const key = `${organizationId}:${scheduleId}`;
	const cached = alarmCache.get(key);
	if (cached && Date.now() - cached.ts < ALARM_CACHE_TTL) {
		return cached.data;
	}
	const data = await fetchLinkedAlarms(scheduleId, organizationId);
	alarmCache.set(key, { ts: Date.now(), data });
	return data;
}

export async function getPreviousMonitorStatus(
	siteId: string,
): Promise<number | undefined> {
	if (!process.env.CLICKHOUSE_URL) {
		return;
	}
	try {
		const rows = await chQuery<{ status: number }>(
			`SELECT status
       FROM uptime.uptime_monitor
       WHERE site_id = {siteId:String}
       ORDER BY timestamp DESC
       LIMIT 1`,
			{ siteId },
		);
		const row = rows[0];
		if (row === undefined) {
			return;
		}
		return row.status;
	} catch (error) {
		captureError(error, { error_step: "clickhouse_previous_status" });
		return;
	}
}

export interface TransitionResult {
	alarms_fired: number;
	transition_kind: "down" | "recovered" | null;
}

export async function sendUptimeTransitionEmailsIfNeeded(options: {
	schedule: ScheduleData;
	data: UptimeData;
	previousStatus?: number;
}): Promise<TransitionResult> {
	const none: TransitionResult = { alarms_fired: 0, transition_kind: null };

	if (!UPTIME_ENV.isProduction) {
		return none;
	}

	if (
		options.previousStatus !== undefined &&
		resolveTransitionKind(options.previousStatus, options.data.status) === null
	) {
		return none;
	}

	const kind = await claimTransition(options.schedule.id, options.data.status);
	if (kind === null) {
		return none;
	}

	const linkedAlarms = await getLinkedAlarms(
		options.schedule.id,
		options.schedule.organizationId,
	);
	if (linkedAlarms.length === 0) {
		return { alarms_fired: 0, transition_kind: kind };
	}

	const siteLabel = buildSiteLabel(options.schedule);
	const baseUrl = process.env.DASHBOARD_APP_URL ?? "https://app.databuddy.cc";
	const dashboardUrl = `${baseUrl.replace(TRAILING_SLASH, "")}/monitors/${options.schedule.id}`;

	const title =
		kind === "down"
			? `[DOWN] ${siteLabel} is unreachable`
			: `[Recovered] ${siteLabel} is back up`;

	const httpInfo = options.data.http_code
		? ` (HTTP ${options.data.http_code})`
		: "";
	const errorInfo = options.data.error ? ` - ${options.data.error}` : "";

	const message =
		kind === "down"
			? `${siteLabel} is down${httpInfo}${errorInfo}. View details: ${dashboardUrl}`
			: `${siteLabel} has recovered and is operational again. Response time: ${options.data.total_ms}ms. View details: ${dashboardUrl}`;

	const payload = {
		title,
		message,
		priority: kind === "down" ? ("high" as const) : ("normal" as const),
		metadata: {
			template: "uptime-transition",
			monitorId: options.schedule.id,
			monitorName: siteLabel,
			url: options.data.url,
			kind,
			httpCode: options.data.http_code,
			dashboardUrl,
		},
	};

	const sendable = linkedAlarms
		.filter((a) => a.destinations && a.destinations.length > 0)
		.map((alarm) => {
			const { clientConfig, channels } = toNotificationConfig(
				alarm.destinations,
			);
			return { alarm, clientConfig, channels };
		})
		.filter((s) => s.channels.length > 0);

	const results = await Promise.allSettled(
		sendable.map(({ alarm, clientConfig, channels }) =>
			new NotificationClient(clientConfig)
				.send(payload, { channels })
				.catch((error) => {
					captureError(error, {
						error_step: "alarm_notification",
						alarm_id: alarm.id,
					});
					throw error;
				}),
		),
	);

	const fired = results.filter((r) => r.status === "fulfilled").length;
	return { alarms_fired: fired, transition_kind: kind };
}
