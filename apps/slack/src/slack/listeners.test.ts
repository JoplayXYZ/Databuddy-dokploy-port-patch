import { describe, expect, it } from "bun:test";
import type { App } from "@slack/bolt";
import type { DatabuddyAgentClient, SlackAgentRun } from "../agent/agent-client";
import type { SlackInstallationStore } from "./installations";
import { registerSlackListeners } from "./listeners";
import { SLACK_COPY } from "./messages";
import type {
	SlackFollowUpQueueResult,
	SlackThreadQueueStore,
} from "./thread-queue";

type Handler = (input: Record<string, unknown>) => Promise<void>;

class FakeSlackApp {
	commands = new Map<string, Handler>();
	events = new Map<string, Handler>();
	messages: Handler[] = [];

	assistant(value: unknown) {
		this.events.set("assistant", value as Handler);
	}

	command(name: string, handler: Handler) {
		this.commands.set(name, handler);
	}

	event(name: string, handler: Handler) {
		this.events.set(name, handler);
	}

	message(handler: Handler) {
		this.messages.push(handler);
	}
}

function createClient() {
	const apiCalls: Array<{ method: string; options: Record<string, unknown> }> = [];
	const reactionAdds: Record<string, unknown>[] = [];
	return {
		apiCalls,
		client: {
			apiCall: async (method: string, options?: Record<string, unknown>) => {
				apiCalls.push({ method, options: options ?? {} });
				return method === "chat.startStream"
					? { ok: true, ts: "response_ts" }
					: { ok: true };
			},
			reactions: {
				add: async (options: Record<string, unknown>) => {
					reactionAdds.push(options);
				},
			},
		},
		reactionAdds,
	};
}

function createAgent() {
	const runs: SlackAgentRun[] = [];
	const agent = {
		async *stream(run: SlackAgentRun) {
			runs.push(run);
			yield "Done";
		},
	} as unknown as DatabuddyAgentClient;

	return { agent, runs };
}

function createInstallations() {
	return {
		bindChannel: async () => ({ message: SLACK_COPY.bindSuccess, ok: true }),
		getChannelReadiness: async () => ({ message: "", ok: true }),
		getTeamContext: async () => ({
			integrationId: "int_123",
			organizationId: "org_123",
		}),
	} as unknown as SlackInstallationStore;
}

function createQueue(
	overrides: Partial<SlackThreadQueueStore> = {}
): SlackThreadQueueStore & {
	enqueuedRuns: SlackAgentRun[];
	removedMessages: Array<{ channelId: string; messageTs: string; teamId?: string }>;
} {
	const enqueuedRuns: SlackAgentRun[] = [];
	const removedMessages: Array<{
		channelId: string;
		messageTs: string;
		teamId?: string;
	}> = [];

	return {
		enqueuedRuns,
		removedMessages,
		drain: async () => [],
		enqueue: async (run) => {
			enqueuedRuns.push(run);
			return { ok: true, queuedCount: enqueuedRuns.length };
		},
		isEngaged: async () => true,
		markEngaged: async () => undefined,
		release: async () => undefined,
		removeDeletedFollowUp: async (ref) => {
			removedMessages.push(ref);
			return true;
		},
		tryAcquire: async () => true,
		...overrides,
	};
}

const logger = {
	error: () => undefined,
	warn: () => undefined,
};

describe("Slack listeners", () => {
	it("ignores channel thread replies that Databuddy has not joined", async () => {
		const app = new FakeSlackApp();
		const { agent, runs } = createAgent();
		const queue = createQueue({ isEngaged: async () => false });
		const { client } = createClient();
		registerSlackListeners(
			app as unknown as App,
			agent,
			createInstallations(),
			queue
		);

		await app.messages[0]?.({
			client,
			context: { teamId: "T123" },
			logger,
			message: {
				channel: "C123",
				channel_type: "channel",
				text: "also compare campaigns",
				thread_ts: "171234.000",
				ts: "171234.568",
				user: "U123",
			},
			say: async () => undefined,
		});

		expect(runs).toEqual([]);
		expect(queue.enqueuedRuns).toEqual([]);
	});

	it("queues engaged thread follow-ups when another response is active", async () => {
		const app = new FakeSlackApp();
		const { agent, runs } = createAgent();
		const queue = createQueue({ tryAcquire: async () => false });
		const { client } = createClient();
		registerSlackListeners(
			app as unknown as App,
			agent,
			createInstallations(),
			queue
		);

		await app.messages[0]?.({
			client,
			context: { teamId: "T123" },
			logger,
			message: {
				channel: "C123",
				channel_type: "channel",
				text: "also compare campaigns",
				thread_ts: "171234.000",
				ts: "171234.568",
				user: "U123",
			},
			say: async () => undefined,
		});

		expect(runs).toEqual([]);
		expect(queue.enqueuedRuns).toMatchObject([
			{
				channelId: "C123",
				messageTs: "171234.568",
				text: "also compare campaigns",
				threadTs: "171234.000",
				trigger: "thread_follow_up",
			},
		]);
	});

	it("removes queued follow-ups when Slack sends a message_deleted event", async () => {
		const app = new FakeSlackApp();
		const { agent } = createAgent();
		const queue = createQueue();
		const { client } = createClient();
		registerSlackListeners(
			app as unknown as App,
			agent,
			createInstallations(),
			queue
		);

		await app.messages[0]?.({
			client,
			context: { teamId: "T123" },
			logger,
			message: {
				channel: "C123",
				deleted_ts: "171234.568",
				subtype: "message_deleted",
				ts: "171234.999",
			},
			say: async () => undefined,
		});

		expect(queue.removedMessages).toEqual([
			{ channelId: "C123", messageTs: "171234.568", teamId: "T123" },
		]);
	});

	it("responds to the help slash command", async () => {
		const app = new FakeSlackApp();
		const { agent } = createAgent();
		const queue = createQueue();
		const responses: unknown[] = [];
		registerSlackListeners(
			app as unknown as App,
			agent,
			createInstallations(),
			queue
		);

		await app.commands.get("/databuddy-help")?.({
			ack: async () => undefined,
			respond: async (message: unknown) => {
				responses.push(message);
			},
		});

		expect(responses).toEqual([
			{ response_type: "ephemeral", text: SLACK_COPY.help },
		]);
	});
});
