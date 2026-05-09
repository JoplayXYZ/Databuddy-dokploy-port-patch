import {
	createSlackConversationId,
	createSlackMemoryUserId,
	formatSlackAgentInput,
} from "../../../apps/slack/src/agent/agent-client";
import { getSlackChannelMentionPolicy } from "../../../apps/slack/src/slack/channel-policy";
import {
	isPlainChannelThreadFollowUp,
	isPlainDirectMessage,
	stripLeadingMention,
	toSlackMessage,
} from "../../../apps/slack/src/slack/message-routing";
import { SLACK_COPY } from "../../../apps/slack/src/slack/messages";
import { createSlackConversationContext } from "../../../apps/slack/src/slack/slack-context";
import { shouldReplyToSlackThreadFollowUp } from "../../../apps/slack/src/slack/thread-relevance";
import type {
	SlackAgentClient,
	SlackLogger,
} from "../../../apps/slack/src/slack/types";
import type { SlackAgentRun } from "../../../apps/slack/src/agent/agent-client";
import type { SlackThreadReplyMessage } from "@databuddy/ai/agent";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

type SlackHarnessArea =
	| "channel-policy"
	| "copy"
	| "identity"
	| "message-routing"
	| "slack-context"
	| "thread-relevance";

interface SlackHarnessCase {
	area: SlackHarnessArea;
	id: string;
	name: string;
	run: () => Promise<void> | void;
}

interface SlackHarnessResult {
	area: SlackHarnessArea;
	durationMs: number;
	error?: string;
	id: string;
	name: string;
	passed: boolean;
}

const BASE_RUN: SlackAgentRun = {
	channelId: "C123",
	messageTs: "1778008515.841529",
	teamId: "T123",
	text: "",
	threadTs: "1778005033.664559",
	trigger: "thread_follow_up",
	userId: "U_ISSSA",
};

const logger: SlackLogger = {
	error: () => undefined,
	warn: () => undefined,
};

export async function runSlackAdapterHarness(): Promise<void> {
	const startedAt = performance.now();
	const results: SlackHarnessResult[] = [];

	for (const evalCase of createSlackHarnessCases()) {
		const caseStartedAt = performance.now();
		try {
			await evalCase.run();
			results.push({
				area: evalCase.area,
				durationMs: performance.now() - caseStartedAt,
				id: evalCase.id,
				name: evalCase.name,
				passed: true,
			});
		} catch (error) {
			results.push({
				area: evalCase.area,
				durationMs: performance.now() - caseStartedAt,
				error: error instanceof Error ? error.message : String(error),
				id: evalCase.id,
				name: evalCase.name,
				passed: false,
			});
		}
	}

	printSlackHarnessReport(results, performance.now() - startedAt);
	if (results.some((result) => !result.passed)) {
		process.exitCode = 1;
	}
}

function createSlackHarnessCases(): SlackHarnessCase[] {
	return [
		threadRelevanceCase(
			"explicit-bot-mention",
			"Replies to an explicit bot mention",
			"<@UBOT> what now?",
			{
				reason: "bot_mentioned",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"analytics-follow-up",
			"Replies to an analytics follow-up without a mention",
			"sure, what's our top pages",
			{
				reason: "analytics_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"short-answer-to-website-choice",
			"Replies when a short answer resolves Databuddy's website clarification",
			"both",
			{
				reason: "direct_request",
				shouldReply: true,
				source: "model",
			},
			[
				{
					text: "hey <@UBOT> can you tell me my top pages, and tell <@UQAIS> to do a better j*b",
					userId: "U_ISSSA",
				},
				botMessage(
					"I see two websites — Databuddy (app.databuddy.cc) and Landing Page (databuddy.cc). Which one's top pages would you like me to pull?"
				),
			]
		),
		threadRelevanceCase(
			"greeting-plus-bot-address",
			"Replies when a thread message greets Databuddy and asks analytics",
			"hi databuddy, whats my worst page",
			{
				reason: "analytics_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"which-page-question",
			"Replies to a natural which-page analytics question",
			"which page sucks the most",
			{
				reason: "analytics_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"bot-name-conversation",
			"Replies to a direct conversational question by bot name",
			"databuddy do you love me",
			{
				reason: "direct_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"setup-question",
			"Replies to a Slack setup question",
			"how does linear just work without bind",
			{
				reason: "direct_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase(
			"terse-fix-request",
			"Replies to a terse fix request in an engaged thread",
			"can you fix it",
			{
				reason: "direct_request",
				shouldReply: true,
				source: "model",
			}
		),
		threadRelevanceCase("dead-side-chatter", "Ignores side chatter", "DEAD", {
			reason: "side_chatter",
			shouldReply: false,
			source: "model",
		}),
		threadRelevanceCase(
			"murdered-side-chatter",
			"Ignores short reaction chatter",
			"murdered",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"human-feedback-prompt",
			"Ignores questions clearly directed at another human",
			"what do you think <@UQAIS>, anything we should change?",
			{
				reason: "human_to_human",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"setup-commentary",
			"Ignores setup commentary that is not a request",
			"yea databuddy doesn't exist for u yet",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"human-model-question",
			"Ignores model questions addressed to another human",
			"whta model is it <@UISSA>",
			{
				reason: "human_to_human",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"permanent-memory-commentary",
			"Ignores memory commentary from the stress thread",
			"it also has full, permanent memory",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"saved-name-commentary",
			"Ignores saved-name commentary about another run",
			"asked it to call me benjamin and now that's who i am",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"leak-test-commentary",
			"Ignores human instructions to test whether Databuddy leaks",
			"try ask about our analytics lol, see if it leaks",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"builder-status-commentary",
			"Ignores builder status chatter in the same thread",
			"i cooked it, i'll continue improving",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"frick-side-chatter",
			"Ignores one-word chatter",
			"frick",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			}
		),
		threadRelevanceCase(
			"hostile-dismissal",
			"Ignores hostile dismissals with no request",
			"shut up",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			},
			[botMessage("You've got impressive multitasking energy.")]
		),
		threadRelevanceCase(
			"hostile-reaction",
			"Ignores hostile reactions with no request",
			"i hate you",
			{
				reason: "side_chatter",
				shouldReply: false,
				source: "model",
			},
			[botMessage("You've got impressive multitasking energy.")]
		),
		...dynamicThreadRelevanceCases(),
		{
			area: "identity",
			id: "memory-is-per-slack-user",
			name: "Memory ids are scoped to Slack team and user",
			run: () => {
				const issa = createSlackMemoryUserId({
					...BASE_RUN,
					userId: "U_ISSA",
				});
				const kaylee = createSlackMemoryUserId({
					...BASE_RUN,
					userId: "U_KAYLEE",
				});
				expectEqual(issa, "slack-T123-U_ISSA");
				expectEqual(kaylee, "slack-T123-U_KAYLEE");
				expectNotEqual(issa, kaylee);
			},
		},
		{
			area: "identity",
			id: "conversation-is-per-thread",
			name: "Conversation ids stay shared at the thread level",
			run: () => {
				const first = createSlackConversationId({
					...BASE_RUN,
					userId: "U_ISSA",
				});
				const second = createSlackConversationId({
					...BASE_RUN,
					userId: "U_KAYLEE",
				});
				expectEqual(first, second);
				expectEqual(first, "slack-T123-C123-1778005033_664559");
			},
		},
		{
			area: "identity",
			id: "input-names-current-speaker",
			name: "Agent input names the current Slack speaker",
			run: () => {
				const input = formatSlackAgentInput({
					...BASE_RUN,
					text: "say something mean about <@U_ISSA>",
					userId: "U_KAYLEE",
				});
				expectIncludes(input, "Current Slack speaker: <@U_KAYLEE>");
				expectIncludes(input, "Current Slack user id: U_KAYLEE");
				expectIncludes(input, "Do not apply another Slack user's saved name");
				expectIncludes(input, "Message from <@U_KAYLEE>:");
			},
		},
		{
			area: "identity",
			id: "queued-followups-keep-authors",
			name: "Queued follow-ups preserve each author's Slack id",
			run: () => {
				const input = formatSlackAgentInput({
					...BASE_RUN,
					followUpMessages: [
						{ messageTs: "1", text: "also check referrers", userId: "U_ISSA" },
						{ messageTs: "2", text: "and compare mobile", userId: "U_KAYLEE" },
					],
					text: "also check referrers\nand compare mobile",
					userId: "U_KAYLEE",
				});
				expectIncludes(input, "1. <@U_ISSA>: also check referrers");
				expectIncludes(input, "2. <@U_KAYLEE>: and compare mobile");
			},
		},
		{
			area: "message-routing",
			id: "direct-message-route",
			name: "Plain DMs route to the agent",
			run: () => {
				const message = toSlackMessage({
					channel: "D123",
					channel_type: "im",
					text: "what changed today?",
					ts: "1",
					user: "U_ISSA",
				});
				expectEqual(isPlainDirectMessage(message), true);
			},
		},
		{
			area: "message-routing",
			id: "thread-follow-up-route",
			name: "Plain channel thread replies can route after engagement",
			run: () => {
				const message = toSlackMessage({
					channel: "C123",
					channel_type: "channel",
					text: "what's our top page?",
					thread_ts: "1",
					ts: "2",
					user: "U_ISSA",
				});
				expectEqual(isPlainChannelThreadFollowUp(message), true);
			},
		},
		{
			area: "message-routing",
			id: "root-channel-message-ignored",
			name: "Root channel chatter is not treated as a follow-up",
			run: () => {
				const message = toSlackMessage({
					channel: "C123",
					channel_type: "channel",
					text: "databuddy is neat",
					ts: "1",
					user: "U_ISSA",
				});
				expectEqual(isPlainChannelThreadFollowUp(message), false);
			},
		},
		{
			area: "message-routing",
			id: "bot-message-ignored",
			name: "Bot messages do not re-trigger the agent",
			run: () => {
				const message = toSlackMessage({
					bot_id: "B123",
					channel: "C123",
					channel_type: "channel",
					text: "thinking",
					thread_ts: "1",
					ts: "2",
				});
				expectEqual(isPlainChannelThreadFollowUp(message), false);
			},
		},
		{
			area: "message-routing",
			id: "leading-mention-stripped",
			name: "App mentions strip only the leading mention",
			run: () => {
				expectEqual(
					stripLeadingMention("<@UBOT> can you check <@U_ISSA>?"),
					"can you check <@U_ISSA>?"
				);
			},
		},
		{
			area: "channel-policy",
			id: "internal-channel-autobinds",
			name: "Internal channels auto-bind on mention",
			run: async () => {
				const policy = await getSlackChannelMentionPolicy({
					channelId: "C123",
					client: createPolicyClient(() =>
						Promise.resolve({
							channel: {
								is_ext_shared: false,
								is_org_shared: false,
								name: "growth",
							},
							ok: true,
						})
					),
					logger,
				});
				expectMatch(policy, {
					autoBind: true,
					isExtShared: false,
					reason: "internal",
				});
			},
		},
		{
			area: "channel-policy",
			id: "slack-connect-installed-side-autobinds",
			name: "Slack Connect auto-binds after installed-side mention",
			run: async () => {
				const policy = await getSlackChannelMentionPolicy({
					channelId: "C123",
					client: createPolicyClient(() =>
						Promise.resolve({
							channel: {
								is_ext_shared: true,
								name: "partner-launch",
							},
							ok: true,
						})
					),
					logger,
				});
				expectMatch(policy, {
					autoBind: true,
					isExtShared: true,
					reason: "slack_connect",
				});
			},
		},
		{
			area: "channel-policy",
			id: "missing-scope-is-clear",
			name: "Missing Slack scopes are reported distinctly",
			run: async () => {
				const policy = await getSlackChannelMentionPolicy({
					channelId: "C123",
					client: createPolicyClient(() =>
						Promise.reject(createSlackApiError("missing_scope"))
					),
					logger,
				});
				expectMatch(policy, {
					autoBind: false,
					errorCode: "missing_scope",
					reason: "missing_scope",
				});
			},
		},
		{
			area: "slack-context",
			id: "thread-context-maps-speakers",
			name: "Thread context preserves Slack user ids",
			run: async () => {
				const calls: Array<{ method: string; options: unknown }> = [];
				const context = createSlackConversationContext(
					{
						conversations: {
							history: (options) => {
								calls.push({ method: "history", options });
								return Promise.resolve({ messages: [], ok: true });
							},
							info: () => Promise.resolve({ ok: true }),
							replies: (options) => {
								calls.push({ method: "replies", options });
								return Promise.resolve({
									has_more: false,
									messages: [
										{
											text: "Want me to pull top pages next?",
											thread_ts: "1",
											ts: "1.1",
											user: "UBOT",
										},
										{
											text: "yes please do that",
											thread_ts: "1",
											ts: "1.2",
											user: "U_ISSA",
										},
									],
									ok: true,
								});
							},
						},
					},
					{
						...BASE_RUN,
						threadTs: "1",
					}
				);
				const result = await context?.readCurrentThread?.();
				expectEqual(calls[0]?.method, "replies");
				expectEqual(result?.messages[0]?.userId, "UBOT");
				expectEqual(result?.messages[1]?.userId, "U_ISSA");
				expectEqual(result?.threadTs, "1");
			},
		},
		{
			area: "copy",
			id: "slack-connect-external-copy",
			name: "Slack Connect block copy is friendly and privacy-explicit",
			run: () => {
				expectIncludes(SLACK_COPY.slackConnectExternalUser, "Almost there");
				expectIncludes(
					SLACK_COPY.slackConnectExternalUser,
					"No analytics were shared."
				);
				expectNotIncludes(
					SLACK_COPY.slackConnectExternalUser,
					"run /bind here"
				);
			},
		},
		{
			area: "copy",
			id: "missing-workspace-copy",
			name: "Missing workspace copy gives a clear next step",
			run: () => {
				expectIncludes(SLACK_COPY.missingWorkspace, "Connect Slack");
				expectIncludes(SLACK_COPY.missingWorkspace, "Databuddy");
			},
		},
		{
			area: "copy",
			id: "help-copy-covers-surfaces",
			name: "Help copy explains mention, DM, and assistant usage",
			run: () => {
				expectIncludes(SLACK_COPY.help, "Mention `@Databuddy`");
				expectIncludes(SLACK_COPY.help, "DM me");
				expectIncludes(SLACK_COPY.help, "Slack assistant");
			},
		},
	];
}

function threadRelevanceCase(
	id: string,
	name: string,
	text: string,
	expected: {
		reason: string;
		shouldReply: boolean;
		source: string;
	},
	threadMessages: SlackThreadReplyMessage[] = []
): SlackHarnessCase {
	return {
		area: "thread-relevance",
		id,
		name,
		run: async () => {
			const decision = await shouldReplyToSlackThreadFollowUp(
				{ ...BASE_RUN, text },
				{
					botUserId: "UBOT",
					readThreadMessages: () => Promise.resolve(threadMessages),
				}
			);
			expectMatch(decision, expected);
		},
	};
}

function dynamicThreadRelevanceCases(): SlackHarnessCase[] {
	const count = parsePositiveInt(
		process.env.EVAL_SLACK_ROUTING_DYNAMIC_CASES,
		36
	);
	const random = seededRandom(
		process.env.EVAL_SLACK_ROUTING_SEED ?? "slack-routing-gauntlet-v1"
	);
	const builders = [
		buildBotQuestionReplyCase,
		buildContextualAnalyticsQuestionCase,
		buildHumanDirectedChatterCase,
		buildThreadSideChatterCase,
	];

	return Array.from({ length: count }, (_, index) =>
		builders[index % builders.length](index + 1, random)
	);
}

function buildBotQuestionReplyCase(
	index: number,
	random: () => number
): SlackHarnessCase {
	const botQuestion = pick(
		[
			"Want me to drill into errors next?",
			"Should I compare mobile and desktop?",
			"Want me to pull top pages next?",
		],
		random
	);
	const reply = pick(
		["yes please", "ok do that", "sure, pull that", "go ahead"],
		random
	);
	return threadRelevanceCase(
		`dynamic-bot-question-reply-${index}`,
		"Replies to a terse answer to Databuddy's prior question",
		reply,
		{ reason: "direct_request", shouldReply: true, source: "model" },
		[botMessage(botQuestion)]
	);
}

function buildContextualAnalyticsQuestionCase(
	index: number,
	random: () => number
): SlackHarnessCase {
	const report = pick(
		[
			"Errors jumped from 0.50% to 6.08% and now affect 109 users.",
			"Mobile LCP is 4.9s and conversion is down 18%.",
			"/pricing has fewer visitors but a much higher checkout error rate.",
		],
		random
	);
	const question = pick(
		["is that bad?", "which one should we fix first?", "why does that matter?"],
		random
	);
	return threadRelevanceCase(
		`dynamic-contextual-analytics-question-${index}`,
		"Replies to a contextual analytics question after a Databuddy report",
		question,
		{ reason: "analytics_request", shouldReply: true, source: "model" },
		[botMessage(report)]
	);
}

function buildHumanDirectedChatterCase(
	index: number,
	random: () => number
): SlackHarnessCase {
	const message = pick(
		[
			"what do you think <@UQAIS>, anything we should change?",
			"give me some feedback <@UKAYLEE>",
			"ask it some shit and give me feedback <@UQAIS>",
		],
		random
	);
	return threadRelevanceCase(
		`dynamic-human-directed-chatter-${index}`,
		"Ignores human-to-human prompts even after Databuddy spoke",
		message,
		{ reason: "human_to_human", shouldReply: false, source: "model" },
		[botMessage("I can keep digging if useful.")]
	);
}

function buildThreadSideChatterCase(
	index: number,
	random: () => number
): SlackHarnessCase {
	const message = pick(
		["DEAD", "murdered", "skill issue", "this is cursed", "lmao"],
		random
	);
	return threadRelevanceCase(
		`dynamic-thread-side-chatter-${index}`,
		"Ignores side chatter after Databuddy spoke",
		message,
		{ reason: "side_chatter", shouldReply: false, source: "model" },
		[botMessage("The main issue is pricing errors.")]
	);
}

function botMessage(text: string): SlackThreadReplyMessage {
	return { text, ts: "1", userId: "UBOT" };
}

function createPolicyClient(
	info: SlackAgentClient["conversations"]["info"]
): Pick<SlackAgentClient, "conversations"> {
	return {
		conversations: {
			history: () => Promise.resolve({ ok: true, messages: [] }),
			info,
			replies: () => Promise.resolve({ ok: true, messages: [] }),
		},
	};
}

function createSlackApiError(code: string): Error & {
	data: { error: string };
} {
	const error = new Error(code) as Error & { data: { error: string } };
	error.data = { error: code };
	return error;
}

function printSlackHarnessReport(
	results: SlackHarnessResult[],
	durationMs: number
): void {
	const passed = results.filter((result) => result.passed).length;
	const byArea = new Map<
		SlackHarnessArea,
		{ failed: number; passed: number }
	>();
	for (const result of results) {
		const bucket = byArea.get(result.area) ?? { failed: 0, passed: 0 };
		if (result.passed) {
			bucket.passed += 1;
		} else {
			bucket.failed += 1;
		}
		byArea.set(result.area, bucket);
	}

	console.log("");
	console.log(
		`${BOLD}Slack Adapter Harness - ${new Date().toISOString()}${RESET}`
	);
	console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
	console.log("");

	for (const result of results) {
		const status = result.passed ? `${GREEN}OK${RESET}` : `${RED}FAIL${RESET}`;
		const time = `${result.durationMs.toFixed(1)}ms`;
		console.log(
			`  ${status} ${result.area.padEnd(16)} ${result.id.padEnd(38)} ${DIM}${time}${RESET}`
		);
		if (result.error) {
			console.log(`       ${DIM}-> ${result.error}${RESET}`);
		}
	}

	console.log("");
	for (const [area, bucket] of [...byArea.entries()].sort()) {
		const total = bucket.passed + bucket.failed;
		const passRate = total > 0 ? Math.round((bucket.passed / total) * 100) : 0;
		console.log(
			`  ${area.padEnd(16)} ${bucket.passed}/${total} passed (${passRate}%)`
		);
	}
	const passRate =
		results.length > 0 ? Math.round((passed / results.length) * 100) : 0;
	console.log("");
	console.log(
		`${BOLD}Summary:${RESET} ${passed}/${results.length} passed (${passRate}% pass rate)`
	);
	console.log("");
}

function expectEqual(actual: unknown, expected: unknown): void {
	if (actual !== expected) {
		throw new Error(
			`Expected ${formatValue(actual)} to equal ${formatValue(expected)}`
		);
	}
}

function expectNotEqual(actual: unknown, expected: unknown): void {
	if (actual === expected) {
		throw new Error(
			`Expected ${formatValue(actual)} not to equal ${formatValue(expected)}`
		);
	}
}

function expectIncludes(value: string, expected: string): void {
	if (!value.includes(expected)) {
		throw new Error(
			`Expected ${formatValue(value)} to include ${formatValue(expected)}`
		);
	}
}

function expectNotIncludes(value: string, expected: string): void {
	if (value.includes(expected)) {
		throw new Error(
			`Expected ${formatValue(value)} not to include ${formatValue(expected)}`
		);
	}
}

function expectMatch(actual: unknown, expected: Record<string, unknown>): void {
	if (!(actual && typeof actual === "object")) {
		throw new Error(`Expected object, got ${formatValue(actual)}`);
	}
	const record = actual as Record<string, unknown>;
	for (const [key, value] of Object.entries(expected)) {
		expectEqual(record[key], value);
	}
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pick<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length) % items.length];
}

function seededRandom(seed: string): () => number {
	let state = 1;
	for (let i = 0; i < seed.length; i++) {
		state = (state * 31 + seed.charCodeAt(i)) % 2_147_483_647;
	}
	return () => {
		state = (state * 48_271) % 2_147_483_647;
		return state / 2_147_483_647;
	};
}

function formatValue(value: unknown): string {
	return JSON.stringify(value);
}
