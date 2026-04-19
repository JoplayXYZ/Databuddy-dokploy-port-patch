import type { NotificationChannel } from "@databuddy/notifications";

interface AlarmDest {
	config: unknown;
	identifier: string;
	type: string;
}

export function toNotificationConfig(destinations: AlarmDest[]) {
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
