import { describe, expect, it } from "bun:test";
import {
	createSlackChatId,
	DatabuddyAgentClient,
	parseAgentStreamPayload,
	readAgentStream,
} from "./agent-client";

describe("Databuddy Slack agent client", () => {
	it("creates stable Slack-scoped chat ids", () => {
		expect(
			createSlackChatId({
				channelId: "C123",
				messageTs: "171234.567",
				teamId: "T123",
				text: "hello",
				threadTs: "171234.000",
				trigger: "app_mention",
				userId: "U123",
			})
		).toBe("slack-T123-C123-171234_000");
	});

	it("parses text deltas from the agent stream protocol", () => {
		expect(
			parseAgentStreamPayload(
				JSON.stringify({ delta: "hello", type: "text-delta" })
			)
		).toBe("hello");
	});

	it("reads text events from an SSE response", async () => {
		const encoder = new TextEncoder();
		const response = new Response(
			new ReadableStream({
				start(controller) {
					controller.enqueue(
						encoder.encode(
							[
								'data: {"type":"text-delta","delta":"Hello"}\n',
								'data: {"type":"text-delta","delta":" world"}\n',
								"data: [DONE]\n",
							].join("")
						)
					);
					controller.close();
				},
			})
		);

		const text: string[] = [];
		for await (const chunk of readAgentStream(response)) {
			text.push(chunk);
		}

		expect(text.join("")).toBe("Hello world");
	});

	it("sends resolved org integration context to the Databuddy agent API", async () => {
		const originalFetch = globalThis.fetch;
		const captured: { body?: unknown; headers?: Headers } = {};
		const fetchMock = Object.assign(
			async (
				input: Parameters<typeof fetch>[0],
				init?: Parameters<typeof fetch>[1]
			) => {
				const request =
					input instanceof Request
						? new Request(input, init)
						: new Request(input.toString(), init);
				captured.body = init?.body ? JSON.parse(String(init.body)) : null;
				captured.headers = request.headers;
				return new Response(
					'data: {"type":"text-delta","delta":"Done"}\n',
					{ status: 200 }
				);
			},
			{ preconnect: originalFetch.preconnect }
		);
		globalThis.fetch = fetchMock;

		try {
			const client = new DatabuddyAgentClient(
				{
					apiUrl: "http://api.test",
					internalSecret: "secret",
				},
				{
					resolve: async () => ({
						agentApiKeyId: "key_123",
						organizationId: "org_123",
						teamId: "T123",
						websiteId: "site_123",
					}),
				}
			);

			const answer = await client.runToText({
				channelId: "C123",
				teamId: "T123",
				text: "Summarize traffic",
				trigger: "direct_message",
				userId: "U123",
			});

			expect(answer).toBe("Done");
			if (!captured.headers) {
				throw new Error("Expected the agent client to call fetch");
			}
			expect(captured.headers.get("x-databuddy-api-key-id")).toBe("key_123");
			expect(captured.headers.get("x-databuddy-internal-secret")).toBe(
				"secret"
			);
			expect(captured.body).toMatchObject({
				websiteId: "site_123",
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
