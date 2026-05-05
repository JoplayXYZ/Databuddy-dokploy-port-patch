import { Assistant, type App } from "@slack/bolt";
import type {
	DatabuddyAgentClient,
	SlackAgentRun,
} from "../agent/agent-client";
import { createSlackEventLog } from "../lib/evlog-slack";
import { abortSlackActiveRun } from "./active-runs";
import { getSlackChannelMentionPolicy } from "./channel-policy";
import { logSlackReactionFeedback } from "./feedback";
import type { SlackInstallationStore } from "./installations";
import {
	createRecentDedupe,
	isPlainChannelThreadFollowUp,
	isPlainDirectMessage,
	stripLeadingMention,
	toDeletedSlackMessage,
	toSlackMessage,
	toThreadTitle,
} from "./message-routing";
import { SLACK_COPY, SLACK_SUGGESTED_PROMPTS } from "./messages";
import { handleAgentRun } from "./run-handler";
import { respondToBindCommand, respondToStatusCommand } from "./slash-commands";
import { slackThreadQueue, type SlackThreadQueueStore } from "./thread-queue";

export function registerSlackListeners(
	app: App,
	agent: DatabuddyAgentClient,
	installations: SlackInstallationStore,
	threadQueue: SlackThreadQueueStore = slackThreadQueue
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
				loading_messages: [SLACK_COPY.streamOpening],
				status: "is thinking...",
			});

			const run: SlackAgentRun = {
				channelId,
				messageTs,
				teamId: context.teamId,
				text,
				threadTs: msg.thread_ts ?? messageTs,
				trigger: "assistant",
				userId,
			};
			await threadQueue.markEngaged(run);
			await handleAgentRun({
				agent,
				client,
				threadQueue,
				logger,
				run,
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

		const channelPolicy = await getSlackChannelMentionPolicy({
			channelId: event.channel,
			client,
			logger,
		});
		const readiness = await installations.getChannelReadiness({
			autoBind: channelPolicy.autoBind,
			channelId: event.channel,
			teamId,
		});
		if (!readiness.ok) {
			logChannelGate({
				channelId: event.channel,
				errorCode: channelPolicy.errorCode,
				messageTs: event.ts,
				policyReason: channelPolicy.reason,
				teamId,
				userId: event.user,
			});
			await say({
				text:
					channelPolicy.reason === "slack_connect"
						? SLACK_COPY.slackConnectNeedsBind
						: channelPolicy.reason === "missing_scope"
							? SLACK_COPY.missingSlackScopes
							: readiness.message,
				thread_ts: threadTs,
			});
			return;
		}

		const run: SlackAgentRun = {
			channelId: event.channel,
			messageTs: event.ts,
			teamId,
			text,
			threadTs,
			trigger: "app_mention",
			userId: event.user,
		};
		await threadQueue.markEngaged(run);
		await handleAgentRun({
			agent,
			client,
			threadQueue,
			logger,
			run,
			say,
		});
	});

	app.message(async ({ client, context, logger, message, say }) => {
		const msg = toSlackMessage(message);
		const deletedMessage = toDeletedSlackMessage(msg);
		if (deletedMessage) {
			const teamId = context.teamId ?? deletedMessage.team;
			const queuedFollowUpRemoved = await threadQueue.removeDeletedFollowUp({
				channelId: deletedMessage.channel,
				messageTs: deletedMessage.deletedTs,
				teamId,
			});
			const activeRunAborted = abortSlackActiveRun({
				channelId: deletedMessage.channel,
				messageTs: deletedMessage.deletedTs,
				teamId,
			});
			createSlackEventLog({
				slack_active_run_aborted: activeRunAborted,
				slack_channel_id: deletedMessage.channel,
				slack_deleted_message_ts: deletedMessage.deletedTs,
				slack_event: "message_deleted",
				slack_followup_removed: queuedFollowUpRemoved,
				slack_team_id: teamId,
			}).emit();
			return;
		}

		if (isPlainDirectMessage(msg)) {
			if (
				!dedupe.claim(
					[msg.team ?? "", msg.channel, msg.client_msg_id ?? msg.ts].join(":")
				)
			) {
				return;
			}

			await handleAgentRun({
				agent,
				client,
				threadQueue,
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
			return;
		}

		if (!isPlainChannelThreadFollowUp(msg)) {
			return;
		}

		const teamId = context.teamId ?? msg.team;
		const run: SlackAgentRun = {
			channelId: msg.channel,
			messageTs: msg.ts,
			teamId,
			text: msg.text,
			threadTs: msg.thread_ts,
			trigger: "thread_follow_up",
			userId: msg.user,
		};
		if (!(await threadQueue.isEngaged(run))) {
			return;
		}
		if (!dedupe.claim([teamId ?? "", msg.channel, msg.ts].join(":"))) {
			return;
		}

		await handleAgentRun({
			agent,
			client,
			threadQueue,
			logger,
			run,
			say,
		});
	});

	app.command("/databuddy-help", async ({ ack, respond }) => {
		await ack();
		await respond({
			response_type: "ephemeral",
			text: SLACK_COPY.help,
		});
	});

	app.command(
		"/databuddy-status",
		async ({ ack, command, logger, respond }) => {
			await ack();
			await respondToStatusCommand({
				command,
				installations,
				logger,
				respond,
			});
		}
	);

	app.command("/bind", async ({ ack, command, logger, respond }) => {
		await ack();
		await respondToBindCommand({
			command,
			installations,
			logger,
			respond,
		});
	});

	app.event("reaction_added", async ({ context, event, logger }) => {
		await logSlackReactionFeedback({
			action: "added",
			botUserId: context.botUserId,
			event,
			installations,
			logger,
			teamId: context.teamId,
		});
	});

	app.event("reaction_removed", async ({ context, event, logger }) => {
		await logSlackReactionFeedback({
			action: "removed",
			botUserId: context.botUserId,
			event,
			installations,
			logger,
			teamId: context.teamId,
		});
	});
}

function logChannelGate({
	channelId,
	errorCode,
	messageTs,
	policyReason,
	teamId,
	userId,
}: {
	channelId: string;
	errorCode?: string;
	messageTs: string;
	policyReason: string;
	teamId?: string;
	userId: string;
}) {
	createSlackEventLog({
		slack_channel_gate_reason: policyReason,
		slack_channel_id: channelId,
		slack_channel_lookup_error: errorCode,
		slack_event: "channel_gate",
		slack_message_ts: messageTs,
		slack_team_id: teamId,
		slack_user_id: userId,
	}).emit();
}
