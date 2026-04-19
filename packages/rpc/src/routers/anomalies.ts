import { and, db, eq } from "@databuddy/db";
import { alarms } from "@databuddy/db/schema";
import {
	buildAnomalyNotificationPayload,
	NotificationClient,
} from "@databuddy/notifications";
import { z } from "zod";
import { toNotificationConfig } from "../lib/alarm-notifications";
import {
	detectAnomalies,
	fetchAnomalyTimeSeries,
} from "../lib/anomaly-detection";
import { protectedProcedure } from "../orpc";
import { withWorkspace } from "../procedures/with-workspace";

const anomalySchema = z.object({
	metric: z.enum(["pageviews", "custom_events", "errors"]),
	type: z.enum(["spike", "drop"]),
	severity: z.enum(["warning", "critical"]),
	currentValue: z.number(),
	baselineMean: z.number(),
	baselineStdDev: z.number(),
	zScore: z.number(),
	percentChange: z.number(),
	detectedAt: z.string(),
	periodStart: z.string(),
	periodEnd: z.string(),
	eventName: z.string().optional(),
});

const timeSeriesPointSchema = z.object({
	hour: z.string(),
	count: z.number(),
});

export const anomaliesRouter = {
	detect: protectedProcedure
		.route({
			method: "POST",
			path: "/anomalies/detect",
			tags: ["Anomalies"],
			summary: "Detect anomalies",
			description:
				"Runs anomaly detection for a website across pageviews, errors, and custom events.",
		})
		.input(
			z.object({
				websiteId: z.string().min(1),
				config: z
					.object({
						warningThreshold: z.number().min(0.5).max(10).optional(),
						criticalThreshold: z.number().min(1).max(15).optional(),
						baselineDays: z.number().int().min(3).max(30).optional(),
						minimumBaselineCount: z.number().int().min(1).optional(),
						percentChangeFallback: z.number().min(50).max(1000).optional(),
					})
					.optional(),
			})
		)
		.output(z.array(anomalySchema))
		.handler(async ({ context, input }) => {
			const workspace = await withWorkspace(context, {
				websiteId: input.websiteId,
				permissions: ["read"],
			});

			return detectAnomalies(workspace.website.id, input.config ?? {});
		}),

	timeSeries: protectedProcedure
		.route({
			method: "POST",
			path: "/anomalies/time-series",
			tags: ["Anomalies"],
			summary: "Anomaly time series",
			description:
				"Returns hourly event counts for a metric over the past N days for charting.",
		})
		.input(
			z.object({
				websiteId: z.string().min(1),
				metric: z.enum(["pageviews", "custom_events", "errors"]),
				days: z.number().int().min(1).max(30).default(7),
			})
		)
		.output(z.array(timeSeriesPointSchema))
		.handler(async ({ context, input }) => {
			const workspace = await withWorkspace(context, {
				websiteId: input.websiteId,
				permissions: ["read"],
			});

			return fetchAnomalyTimeSeries(
				workspace.website.id,
				input.metric,
				input.days
			);
		}),

	notify: protectedProcedure
		.route({
			method: "POST",
			path: "/anomalies/notify",
			tags: ["Anomalies"],
			summary: "Send anomaly notifications",
			description:
				"Runs detection and sends notifications to all matching alarm destinations for traffic_spike/error_rate triggers.",
		})
		.input(
			z.object({
				websiteId: z.string().min(1),
			})
		)
		.output(
			z.object({
				anomaliesFound: z.number(),
				notificationsSent: z.number(),
			})
		)
		.handler(async ({ context, input }) => {
			const workspace = await withWorkspace(context, {
				websiteId: input.websiteId,
				permissions: ["read"],
			});

			const clientId = workspace.website.id;
			const orgId = workspace.organizationId;

			const detected = await detectAnomalies(clientId);

			if (detected.length === 0) {
				return { anomaliesFound: 0, notificationsSent: 0 };
			}

			const matchingAlarms = await db.query.alarms.findMany({
				where: and(eq(alarms.organizationId, orgId), eq(alarms.enabled, true)),
				with: { destinations: true },
			});

			const relevantAlarms = matchingAlarms.filter((alarm) =>
				detected.some((a) => matchesTrigger(alarm.triggerType, a.metric))
			);

			let notificationsSent = 0;

			const siteLabel =
				workspace.website.name || workspace.website.domain || clientId;

			for (const alarm of relevantAlarms) {
				if (!alarm.destinations || alarm.destinations.length === 0) {
					continue;
				}

				const relevantAnomalies = detected.filter((a) =>
					matchesTrigger(alarm.triggerType, a.metric)
				);

				for (const anomaly of relevantAnomalies) {
					const payload = buildAnomalyNotificationPayload({
						kind: anomaly.type,
						metric: anomaly.metric,
						siteLabel,
						currentValue: anomaly.currentValue,
						baselineValue: anomaly.baselineMean,
						percentChange: anomaly.percentChange,
						zScore: anomaly.zScore,
						severity: anomaly.severity,
						periodStart: anomaly.periodStart,
						periodEnd: anomaly.periodEnd,
						eventName: anomaly.eventName,
					});

					const { clientConfig, channels } = toNotificationConfig(
						alarm.destinations
					);
					if (channels.length === 0) {
						continue;
					}

					const client = new NotificationClient(clientConfig);
					const results = await client.send(payload, { channels });
					notificationsSent += results.filter((r) => r.success).length;
				}
			}

			return {
				anomaliesFound: detected.length,
				notificationsSent,
			};
		}),
};

function matchesTrigger(triggerType: string, metric: string): boolean {
	if (triggerType === "traffic_spike") {
		return metric === "pageviews" || metric === "custom_events";
	}
	return triggerType === "error_rate" && metric === "errors";
}
