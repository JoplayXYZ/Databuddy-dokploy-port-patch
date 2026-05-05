import type { RequestLogger } from "evlog";
import type { WebClient } from "@slack/web-api";
import type {
	DatabuddyAgentClient,
	SlackAgentRun,
} from "../agent/agent-client";
import { setSlackLog, toError } from "../lib/evlog-slack";
import { SLACK_COPY } from "./messages";
import { renderAgentOutputForSlack } from "./output-adapter";

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
	abortSignal?: AbortSignal;
	agent: Pick<DatabuddyAgentClient, "stream">;
	client: Pick<WebClient, "apiCall">;
	eventLog?: RequestLogger;
	logger: LoggerLike;
	run: SlackAgentRun;
	say: SayFn;
}

export interface StreamAgentToSlackResult {
	aborted?: boolean;
	answerChars: number;
	chunks: number;
	ok: boolean;
	responseTs?: string;
	streamed: boolean;
}

export async function streamAgentToSlack({
	abortSignal,
	agent,
	client,
	eventLog,
	logger,
	run,
	say,
}: StreamAgentToSlackOptions): Promise<StreamAgentToSlackResult> {
	let streamTs: string | null = null;
	let streamStartAttempted = false;
	let pending = "";
	let fullText = "";
	let safeMarkdown = "";
	let chunks = 0;
	let convertedComponentCount = 0;
	let droppedComponentCount = 0;
	let lastFlushAt = Date.now();
	const startedAt = performance.now();

	const shouldStream = Boolean(run.threadTs);

	const flush = async (force = false) => {
		if (!pending) {
			return;
		}

		if (shouldStream && !streamTs && !streamStartAttempted) {
			await tryStartStream();
		}

		if (!streamTs) {
			return;
		}
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
			}
		} while (force && pending);
	};

	const tryStartStream = async () => {
		const initialText = pending.slice(0, STREAM_APPEND_LIMIT_CHARS);
		if (!initialText.trim()) {
			return;
		}

		streamStartAttempted = true;
		pending = pending.slice(initialText.length);
		streamTs = await startSlackStream(client, run, logger, initialText);
		if (!streamTs) {
			pending = initialText + pending;
		}
		setSlackLog(eventLog, { slack_stream_started: Boolean(streamTs) });
	};

	const appendSafeSlackMarkdown = (streaming: boolean) => {
		const rendered = renderAgentOutputForSlack(fullText, { streaming });
		convertedComponentCount = rendered.convertedComponents;
		droppedComponentCount = rendered.droppedComponents;
		if (rendered.markdown.startsWith(safeMarkdown)) {
			pending += rendered.markdown.slice(safeMarkdown.length);
			safeMarkdown = rendered.markdown;
		}
	};

	try {
		for await (const chunk of agent.stream(run, { abortSignal })) {
			chunks++;
			fullText += chunk;
			appendSafeSlackMarkdown(true);
			await flush(false);
		}
		appendSafeSlackMarkdown(false);
		await flush(true);

		const finalText = safeMarkdown.trim();
		if (streamTs) {
			await client.apiCall("chat.stopStream", {
				channel: run.channelId,
				markdown_text: finalText ? undefined : SLACK_COPY.noAnswer,
				ts: streamTs,
			});
			setSlackLog(eventLog, {
				slack_answer_chars: finalText.length,
				slack_components_converted: convertedComponentCount,
				slack_components_dropped: droppedComponentCount,
				slack_stream_chunks: chunks,
				slack_streamed: true,
				"timing.slack_agent_response_ms": Math.round(
					performance.now() - startedAt
				),
			});
			return {
				answerChars: finalText.length,
				chunks,
				ok: true,
				responseTs: streamTs,
				streamed: true,
			};
		}

		const response = await say({
			text: finalText || SLACK_COPY.noAnswer,
			thread_ts: run.threadTs,
		});
		const responseTs = getSlackMessageTs(response);
		setSlackLog(eventLog, {
			slack_answer_chars: finalText.length,
			slack_components_converted: convertedComponentCount,
			slack_components_dropped: droppedComponentCount,
			slack_response_ts: responseTs,
			slack_stream_chunks: chunks,
			slack_streamed: false,
			"timing.slack_agent_response_ms": Math.round(
				performance.now() - startedAt
			),
		});
		return {
			answerChars: finalText.length,
			chunks,
			ok: true,
			responseTs,
			streamed: false,
		};
	} catch (error) {
		if (abortSignal?.aborted || isAbortError(error)) {
			if (streamTs) {
				await flush(true).catch((flushError) =>
					logger.warn("Failed to flush partial Slack stream", flushError)
				);
				await client
					.apiCall("chat.stopStream", {
						channel: run.channelId,
						ts: streamTs,
					})
					.catch((stopError) =>
						logger.warn("Failed to stop aborted Slack stream", stopError)
					);
			}
			return {
				answerChars: safeMarkdown.trim().length,
				aborted: true,
				chunks,
				ok: false,
				responseTs: streamTs ?? undefined,
				streamed: Boolean(streamTs),
			};
		}

		const err = toError(error);
		logger.error("Slack agent response failed", err);
		eventLog?.error(err, { error_step: "agent_response" });
		appendSafeSlackMarkdown(false);
		const partialText = safeMarkdown.trim();
		if (partialText) {
			await flush(true).catch((flushError) =>
				logger.warn("Failed to flush partial Slack stream", flushError)
			);
			if (streamTs) {
				await client
					.apiCall("chat.stopStream", {
						channel: run.channelId,
						ts: streamTs,
					})
					.catch((stopError) =>
						logger.warn("Failed to stop Slack stream", stopError)
					);
				return {
					answerChars: partialText.length,
					chunks,
					ok: false,
					responseTs: streamTs,
					streamed: true,
				};
			}
			const response = await say({
				text: partialText,
				thread_ts: run.threadTs,
			});
			return {
				answerChars: partialText.length,
				chunks,
				ok: false,
				responseTs: getSlackMessageTs(response),
				streamed: false,
			};
		}
		if (streamTs) {
			await client
				.apiCall("chat.stopStream", {
					channel: run.channelId,
					markdown_text: SLACK_COPY.agentFailure,
					ts: streamTs,
				})
				.catch((stopError) =>
					logger.warn("Failed to stop Slack stream", stopError)
				);
			return {
				answerChars: 0,
				chunks,
				ok: false,
				responseTs: streamTs,
				streamed: true,
			};
		}
		const response = await say({
			text: SLACK_COPY.agentFailure,
			thread_ts: run.threadTs,
		});
		return {
			answerChars: 0,
			chunks,
			ok: false,
			responseTs: getSlackMessageTs(response),
			streamed: false,
		};
	}
}

async function startSlackStream(
	client: Pick<WebClient, "apiCall">,
	run: SlackAgentRun,
	logger: LoggerLike,
	openingText: string
): Promise<string | null> {
	try {
		const result = await client.apiCall("chat.startStream", {
			channel: run.channelId,
			markdown_text: openingText,
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

function getSlackMessageTs(response: unknown): string | undefined {
	return isRecord(response) && typeof response.ts === "string"
		? response.ts
		: undefined;
}

function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	);
}
