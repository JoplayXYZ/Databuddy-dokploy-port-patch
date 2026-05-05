import type { RequestLogger } from "evlog";
import type { WebClient } from "@slack/web-api";
import type {
	DatabuddyAgentClient,
	SlackAgentRun,
	SlackFollowUpMessage,
} from "../agent/agent-client";
import {
	createSlackEventLog,
	getSlackApiErrorCode,
	setSlackLog,
} from "../lib/evlog-slack";
import { cleanupSlackActiveRun, registerSlackActiveRun } from "./active-runs";
import { SLACK_COPY } from "./messages";
import { streamAgentToSlack } from "./respond";
import { createSlackAgentContext } from "./slack-context";
import type { SlackAgentClient, SlackLogger, SlackSay } from "./types";
import type { SlackThreadQueueStore } from "./thread-queue";

const MAX_FOLLOW_UP_ROUNDS = 3;

export async function handleAgentRun({
	agent,
	client,
	logger,
	run,
	say,
	threadQueue,
}: {
	agent: DatabuddyAgentClient;
	client: SlackAgentClient;
	logger: SlackLogger;
	run: SlackAgentRun;
	say: SlackSay;
	threadQueue: SlackThreadQueueStore;
}): Promise<void> {
	const eventLog = createRunLog(run);
	const startedAt = performance.now();
	let lockAcquired = false;
	const abortController = registerSlackActiveRun(run);

	try {
		await addTriggerReaction({ client, eventLog, logger, run });
		await threadQueue.markEngaged(run);
		lockAcquired = await threadQueue.tryAcquire(run);
		if (!lockAcquired) {
			const queued = await threadQueue.enqueue(run);
			setSlackLog(eventLog, {
				slack_followup_queued: queued.ok,
				slack_followup_queue_reason: queued.reason,
				slack_followup_queue_size: queued.queuedCount,
				slack_followup_truncated: queued.truncated,
				slack_response_ok: true,
			});
			return;
		}

		const slackContext =
			run.slackContext ?? createSlackAgentContext(client, run);
		let activeRun: SlackAgentRun = { ...run, slackContext };
		let totalFollowUps = 0;
		for (let round = 0; round <= MAX_FOLLOW_UP_ROUNDS; round++) {
			const result = await streamAgentToSlack({
				abortSignal: abortController?.signal,
				agent,
				client,
				eventLog,
				logger,
				run: activeRun,
				say,
			});
			setSlackLog(eventLog, {
				slack_response_aborted: result.aborted,
				slack_response_ok: result.ok,
				slack_response_ts: result.responseTs,
				slack_response_streamed: result.streamed,
			});

			if (result.aborted || round >= MAX_FOLLOW_UP_ROUNDS) {
				break;
			}

			const followUps = await threadQueue.drain(run);
			if (followUps.length === 0) {
				break;
			}

			totalFollowUps += followUps.length;
			activeRun = createFollowUpRun(activeRun, followUps);
		}

		if (totalFollowUps > 0) {
			setSlackLog(eventLog, {
				slack_followup_drained_count: totalFollowUps,
			});
		}
	} finally {
		if (lockAcquired) {
			await threadQueue.release(run).catch((error) => {
				logger.warn("Failed to release Slack thread lock", error);
			});
		}
		cleanupSlackActiveRun(run);
		setSlackLog(eventLog, {
			"timing.slack_total_ms": Math.round(performance.now() - startedAt),
		});
		eventLog.emit();
	}
}

function createFollowUpRun(
	baseRun: SlackAgentRun,
	followUps: SlackFollowUpMessage[]
): SlackAgentRun {
	const lastFollowUp = followUps.at(-1);
	return {
		...baseRun,
		followUpMessages: followUps,
		messageTs: lastFollowUp?.messageTs ?? baseRun.messageTs,
		text: followUps.map((followUp) => followUp.text).join("\n"),
		trigger: "thread_follow_up",
		userId: lastFollowUp?.userId ?? baseRun.userId,
	};
}

function createRunLog(run: SlackAgentRun): RequestLogger {
	return createSlackEventLog({
		slack_channel_id: run.channelId,
		slack_event: "agent_run",
		slack_message_ts: run.messageTs,
		slack_team_id: run.teamId,
		slack_text_length: run.text.length,
		slack_thread_ts: run.threadTs,
		slack_trigger: run.trigger,
		slack_user_id: run.userId,
	});
}

async function addTriggerReaction({
	client,
	eventLog,
	logger,
	run,
}: {
	client: Pick<WebClient, "reactions">;
	eventLog: RequestLogger;
	logger: SlackLogger;
	run: SlackAgentRun;
}): Promise<void> {
	if (!run.messageTs) {
		return;
	}

	const startedAt = performance.now();
	try {
		await client.reactions.add({
			channel: run.channelId,
			name: SLACK_COPY.processingReaction,
			timestamp: run.messageTs,
		});
		setSlackLog(eventLog, {
			slack_reaction_added: true,
			"timing.slack_reaction_ms": Math.round(performance.now() - startedAt),
		});
	} catch (error) {
		const code = getSlackApiErrorCode(error) ?? "unknown";
		setSlackLog(eventLog, {
			slack_reaction_added: code === "already_reacted",
			slack_reaction_error: code,
			"timing.slack_reaction_ms": Math.round(performance.now() - startedAt),
		});
		if (code !== "already_reacted") {
			logger.warn("Failed to add Slack trigger reaction", code);
		}
	}
}
