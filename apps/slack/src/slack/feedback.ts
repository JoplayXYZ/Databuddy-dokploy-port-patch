import type { SlackInstallationStore } from "./installations";
import { createSlackEventLog, setSlackLog, toError } from "../lib/evlog-slack";
import { SLACK_COPY } from "./messages";

const POSITIVE_REACTIONS = new Set([
	"+1",
	"thumbsup",
	"white_check_mark",
	"heavy_check_mark",
	"heart",
	"green_heart",
	"blue_heart",
	"raised_hands",
	"clap",
	"tada",
	"fire",
	"rocket",
]);

const NEGATIVE_REACTIONS = new Set([
	"-1",
	"thumbsdown",
	"x",
	"heavy_multiplication_x",
	"confused",
	"face_with_raised_eyebrow",
	"warning",
	"rotating_light",
	"broken_heart",
]);

export type SlackFeedbackAction = "added" | "removed";
export type SlackFeedbackSentiment = "positive" | "negative" | "neutral";

interface SlackReactionEventLike {
	eventTs?: string;
	item?: {
		channel?: string;
		ts?: string;
		type?: string;
	};
	itemUser?: string;
	reaction?: string;
	team?: string;
	user?: string;
}

interface SlackFeedbackLogger {
	error(...args: unknown[]): void;
	warn(...args: unknown[]): void;
}

export async function logSlackReactionFeedback({
	action,
	botUserId,
	event,
	installations,
	logger,
	teamId,
}: {
	action: SlackFeedbackAction;
	botUserId?: string;
	event: unknown;
	installations: SlackInstallationStore;
	logger: SlackFeedbackLogger;
	teamId?: string;
}): Promise<void> {
	const reactionEvent = toSlackReactionEvent(event);
	if (
		!reactionEvent?.reaction ||
		reactionEvent.item?.type !== "message" ||
		!reactionEvent.item.channel ||
		!reactionEvent.item.ts
	) {
		return;
	}

	if (reactionEvent.user && botUserId && reactionEvent.user === botUserId) {
		return;
	}

	if (
		reactionEvent.itemUser &&
		botUserId &&
		reactionEvent.itemUser !== botUserId
	) {
		return;
	}

	const normalizedReaction = normalizeReaction(reactionEvent.reaction);
	if (
		action === "added" &&
		normalizedReaction === normalizeReaction(SLACK_COPY.processingReaction)
	) {
		return;
	}

	const resolvedTeamId = teamId ?? reactionEvent.team;
	const sentiment = classifySlackReactionSentiment(normalizedReaction);
	const eventLog = createSlackEventLog({
		slack_channel_id: reactionEvent.item.channel,
		slack_event: "feedback_reaction",
		slack_event_ts: reactionEvent.eventTs,
		slack_feedback_action: action,
		slack_feedback_explicit: sentiment !== "neutral",
		slack_feedback_reaction: normalizedReaction,
		slack_feedback_sentiment: sentiment,
		slack_message_ts: reactionEvent.item.ts,
		slack_team_id: resolvedTeamId,
		slack_user_id: reactionEvent.user,
	});

	try {
		const teamContext = await installations.getTeamContext(resolvedTeamId);
		setSlackLog(eventLog, {
			slack_integration_id: teamContext?.integrationId,
			slack_organization_id: teamContext?.organizationId,
		});
	} catch (error) {
		const err = toError(error);
		logger.warn("Failed to resolve Slack feedback context", err.message);
		eventLog.error(err, { error_step: "feedback_context" });
	} finally {
		eventLog.emit();
	}
}

export function classifySlackReactionSentiment(
	reaction: string
): SlackFeedbackSentiment {
	const normalized = normalizeReaction(reaction);
	if (POSITIVE_REACTIONS.has(normalized)) {
		return "positive";
	}
	if (NEGATIVE_REACTIONS.has(normalized)) {
		return "negative";
	}
	return "neutral";
}

function toSlackReactionEvent(event: unknown): SlackReactionEventLike | null {
	if (!isRecord(event)) {
		return null;
	}
	const item = isRecord(event.item) ? event.item : null;
	return {
		eventTs: getString(event.event_ts),
		item: item
			? {
					channel: getString(item.channel),
					ts: getString(item.ts),
					type: getString(item.type),
				}
			: undefined,
		itemUser: getString(event.item_user),
		reaction: getString(event.reaction),
		team: getString(event.team),
		user: getString(event.user),
	};
}

function normalizeReaction(reaction: string): string {
	return reaction.replace(/^:+|:+$/g, "").toLowerCase();
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
