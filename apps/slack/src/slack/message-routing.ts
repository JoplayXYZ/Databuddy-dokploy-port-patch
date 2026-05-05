const LEADING_APP_MENTION_REGEX = /^<@[A-Z0-9]+>\s*/i;

export interface SlackMessageLike {
	bot_id?: string;
	channel?: string;
	channel_type?: string;
	client_msg_id?: string;
	deleted_ts?: string;
	subtype?: string;
	team?: string;
	text?: string;
	thread_ts?: string;
	ts?: string;
	user?: string;
}

export interface SlackDeletedMessage {
	channel: string;
	deletedTs: string;
	team?: string;
}

export function toSlackMessage(message: unknown): SlackMessageLike | null {
	if (!isRecord(message)) {
		return null;
	}
	return {
		bot_id: getString(message.bot_id),
		channel: getString(message.channel),
		channel_type: getString(message.channel_type),
		client_msg_id: getString(message.client_msg_id),
		deleted_ts: getString(message.deleted_ts),
		subtype: getString(message.subtype),
		team: getString(message.team),
		text: getString(message.text),
		thread_ts: getString(message.thread_ts),
		ts: getString(message.ts),
		user: getString(message.user),
	};
}

export function toDeletedSlackMessage(
	message: SlackMessageLike | null
): SlackDeletedMessage | null {
	if (
		message?.subtype !== "message_deleted" ||
		!message.channel ||
		!message.deleted_ts
	) {
		return null;
	}

	return {
		channel: message.channel,
		deletedTs: message.deleted_ts,
		team: message.team,
	};
}

export function isPlainDirectMessage(
	message: SlackMessageLike | null
): message is SlackMessageLike & {
	channel: string;
	text: string;
	ts: string;
	user: string;
} {
	return Boolean(
		message?.channel &&
			message.channel_type === "im" &&
			message.text &&
			message.ts &&
			message.user &&
			!message.subtype &&
			!message.bot_id
	);
}

export function isPlainChannelThreadFollowUp(
	message: SlackMessageLike | null
): message is SlackMessageLike & {
	channel: string;
	text: string;
	thread_ts: string;
	ts: string;
	user: string;
} {
	return Boolean(
		message?.channel &&
			message.channel_type !== "im" &&
			message.text &&
			message.thread_ts &&
			message.ts &&
			message.thread_ts !== message.ts &&
			message.user &&
			!message.subtype &&
			!message.bot_id
	);
}

export function stripLeadingMention(text: string): string {
	return text.replace(LEADING_APP_MENTION_REGEX, "");
}

export function toThreadTitle(text: string): string {
	const title = text.replace(/\s+/g, " ").trim();
	return title.length > 60 ? `${title.slice(0, 57)}...` : title;
}

export function createRecentDedupe(limit = 500) {
	const seen = new Set<string>();
	const order: string[] = [];

	return {
		claim(key: string): boolean {
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			order.push(key);
			while (order.length > limit) {
				const oldest = order.shift();
				if (oldest) {
					seen.delete(oldest);
				}
			}
			return true;
		},
	};
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
