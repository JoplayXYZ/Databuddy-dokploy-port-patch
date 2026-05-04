import type { WebClient } from "@slack/web-api";
import type {
	DatabuddyAgentClient,
	SlackAgentRun,
} from "../agent/agent-client";

const STREAM_FLUSH_INTERVAL_MS = 900;
const STREAM_FLUSH_CHARS = 1200;
const STREAM_APPEND_LIMIT_CHARS = 3500;

interface LoggerLike {
	error(...args: unknown[]): void;
	warn(...args: unknown[]): void;
}

type SayFn = (message: {
	text: string;
	thread_ts?: string;
}) => Promise<unknown>;

interface StreamAgentToSlackOptions {
	agent: DatabuddyAgentClient;
	client: WebClient;
	logger: LoggerLike;
	run: SlackAgentRun;
	say: SayFn;
}

export async function streamAgentToSlack({
	agent,
	client,
	logger,
	run,
	say,
}: StreamAgentToSlackOptions): Promise<void> {
	let streamTs: string | null = null;
	let pending = "";
	let fullText = "";
	let lastFlushAt = Date.now();

	if (run.threadTs) {
		streamTs = await startSlackStream(client, run, logger);
	}

	const flush = async (force = false) => {
		if (!pending) {
			return;
		}
		const shouldFlush =
			force ||
			pending.length >= STREAM_FLUSH_CHARS ||
			Date.now() - lastFlushAt >= STREAM_FLUSH_INTERVAL_MS;

		if (!shouldFlush) {
			return;
		}

		do {
			const chunk = pending.slice(0, STREAM_APPEND_LIMIT_CHARS);
			pending = pending.slice(chunk.length);
			lastFlushAt = Date.now();

			if (streamTs) {
				await client.apiCall("chat.appendStream", {
					channel: run.channelId,
					markdown_text: chunk,
					ts: streamTs,
				});
			} else {
				fullText += chunk;
			}
		} while (force && pending);
	};

	try {
		for await (const chunk of agent.stream(run)) {
			pending += chunk;
			fullText += streamTs ? chunk : "";
			await flush(false);
		}
		await flush(true);

		const finalText = (fullText || pending).trim();
		if (streamTs) {
			await client.apiCall("chat.stopStream", {
				channel: run.channelId,
				markdown_text: finalText ? undefined : "No answer was generated.",
				ts: streamTs,
			});
			return;
		}

		await say({
			text: finalText || "No answer was generated.",
			thread_ts: run.threadTs,
		});
	} catch (error) {
		logger.error("Slack agent response failed", error);
		const fallback =
			"Sorry, Databuddy could not answer that from Slack yet. The request reached the bot, but the agent handoff failed.";
		if (streamTs) {
			await client
				.apiCall("chat.stopStream", {
					channel: run.channelId,
					markdown_text: fallback,
					ts: streamTs,
				})
				.catch((stopError) =>
					logger.warn("Failed to stop Slack stream", stopError)
				);
			return;
		}
		await say({ text: fallback, thread_ts: run.threadTs });
	}
}

async function startSlackStream(
	client: WebClient,
	run: SlackAgentRun,
	logger: LoggerLike
): Promise<string | null> {
	try {
		const result = await client.apiCall("chat.startStream", {
			channel: run.channelId,
			markdown_text: "",
			recipient_team_id: run.teamId,
			recipient_user_id: run.userId,
			thread_ts: run.threadTs,
			task_display_mode: "plan",
		});

		if (
			isRecord(result) &&
			result.ok === true &&
			typeof result.ts === "string"
		) {
			return result.ts;
		}

		logger.warn(
			"Slack streaming unavailable",
			isRecord(result) && typeof result.error === "string"
				? result.error
				: undefined
		);
		return null;
	} catch (error) {
		logger.warn("Slack streaming failed to start", error);
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
