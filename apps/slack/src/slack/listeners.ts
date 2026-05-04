import { Assistant, type App } from "@slack/bolt";
import type { DatabuddyAgentClient } from "../agent/agent-client";
import type { SlackInstallationStore } from "./installations";
import { SLACK_COPY, SLACK_SUGGESTED_PROMPTS } from "./messages";
import { streamAgentToSlack } from "./respond";

const LEADING_APP_MENTION_REGEX = /^<@[A-Z0-9]+>\s*/i;

interface SlackMessageLike {
	bot_id?: string;
	channel?: string;
	channel_type?: string;
	client_msg_id?: string;
	subtype?: string;
	team?: string;
	text?: string;
	thread_ts?: string;
	ts?: string;
	user?: string;
}

interface SlackSlashCommand {
	channel_id: string;
	team_id?: string;
}

interface SlackSlashLogger {
	error(...args: unknown[]): void;
}

type SlackSlashRespond = (message: {
	response_type: "ephemeral";
	text: string;
}) => Promise<unknown>;

export function registerSlackListeners(
	app: App,
	agent: DatabuddyAgentClient,
	installations: SlackInstallationStore
): void {
	const dedupe = createRecentDedupe();

	const assistant = new Assistant({
		threadContextChanged: async ({ logger, saveThreadContext }) => {
			try {
				await saveThreadContext();
			} catch (error) {
				logger.error(error);
			}
		},
		threadStarted: async ({
			logger,
			saveThreadContext,
			say,
			setSuggestedPrompts,
		}) => {
			try {
				await say(SLACK_COPY.assistantGreeting);
				await saveThreadContext();
				await setSuggestedPrompts({
					prompts: [...SLACK_SUGGESTED_PROMPTS],
					title: SLACK_COPY.suggestedPromptsTitle,
				});
			} catch (error) {
				logger.error(error);
			}
		},
		userMessage: async ({
			client,
			context,
			logger,
			message,
			say,
			setStatus,
			setTitle,
		}) => {
			const msg = toSlackMessage(message);
			const channelId = msg?.channel;
			const messageTs = msg?.ts;
			const text = msg?.text;
			const userId = msg?.user;
			if (!(text && channelId && messageTs && userId)) {
				return;
			}
			if (
				!dedupe.claim(
					[msg.team ?? "", channelId, msg.client_msg_id ?? messageTs].join(":")
				)
			) {
				return;
			}

			await setTitle(toThreadTitle(text));
			await setStatus({
				loading_messages: [
					"Reading analytics context",
					"Planning the query",
					"Checking the numbers",
					"Preparing the answer",
				],
				status: "is thinking...",
			});

			await streamAgentToSlack({
				agent,
				client,
				logger,
				run: {
					channelId,
					messageTs,
					teamId: context.teamId,
					text,
					threadTs: msg.thread_ts ?? messageTs,
					trigger: "assistant",
					userId,
				},
				say,
			});
		},
	});

	app.assistant(assistant);

	app.event("app_mention", async ({ client, context, event, logger, say }) => {
		const threadTs = event.thread_ts ?? event.ts;
		const teamId = context.teamId ?? event.team;
		const text = stripLeadingMention(event.text ?? "").trim();
		if (!event.user) {
			return;
		}
		if (!dedupe.claim([teamId ?? "", event.channel, event.ts].join(":"))) {
			return;
		}
		if (!text) {
			await say({
				text: SLACK_COPY.emptyMention,
				thread_ts: threadTs,
			});
			return;
		}

		const readiness = await installations.getChannelReadiness({
			channelId: event.channel,
			teamId,
		});
		if (!readiness.ok) {
			await say({
				text: readiness.message,
				thread_ts: threadTs,
			});
			return;
		}

		await streamAgentToSlack({
			agent,
			client,
			logger,
			run: {
				channelId: event.channel,
				messageTs: event.ts,
				teamId,
				text,
				threadTs,
				trigger: "app_mention",
				userId: event.user,
			},
			say,
		});
	});

	app.message(async ({ client, context, logger, message, say }) => {
		const msg = toSlackMessage(message);
		if (!isPlainDirectMessage(msg)) {
			return;
		}
		if (
			!dedupe.claim(
				[msg.team ?? "", msg.channel, msg.client_msg_id ?? msg.ts].join(":")
			)
		) {
			return;
		}

		await streamAgentToSlack({
			agent,
			client,
			logger,
			run: {
				channelId: msg.channel,
				messageTs: msg.ts,
				teamId: context.teamId ?? msg.team,
				text: msg.text,
				threadTs: msg.thread_ts ?? msg.ts,
				trigger: "direct_message",
				userId: msg.user,
			},
			say,
		});
	});

	app.command("/bind", async ({ ack, command, logger, respond }) => {
		await ack();
		await respondToBindCommand({
			command,
			installations,
			logger,
			respond,
		});
	});
}

async function respondToBindCommand({
	command,
	installations,
	logger,
	respond,
}: {
	command: SlackSlashCommand;
	installations: SlackInstallationStore;
	logger: SlackSlashLogger;
	respond: SlackSlashRespond;
}): Promise<void> {
	try {
		const result = await installations.bindChannel({
			channelId: command.channel_id,
			teamId: command.team_id,
		});
		await respond({
			response_type: "ephemeral",
			text: result.message,
		});
	} catch (error) {
		logger.error(error);
		await respond({
			response_type: "ephemeral",
			text: SLACK_COPY.bindFailure,
		});
	}
}

function toSlackMessage(message: unknown): SlackMessageLike | null {
	if (!isRecord(message)) {
		return null;
	}
	return {
		bot_id: getString(message.bot_id),
		channel: getString(message.channel),
		channel_type: getString(message.channel_type),
		client_msg_id: getString(message.client_msg_id),
		subtype: getString(message.subtype),
		team: getString(message.team),
		text: getString(message.text),
		thread_ts: getString(message.thread_ts),
		ts: getString(message.ts),
		user: getString(message.user),
	};
}

function isPlainDirectMessage(
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

function stripLeadingMention(text: string): string {
	return text.replace(LEADING_APP_MENTION_REGEX, "");
}

function toThreadTitle(text: string): string {
	const title = text.replace(/\s+/g, " ").trim();
	return title.length > 60 ? `${title.slice(0, 57)}...` : title;
}

function createRecentDedupe(limit = 500) {
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
