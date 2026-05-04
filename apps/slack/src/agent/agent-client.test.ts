import { describe, expect, it } from "bun:test";
import { createSlackChatId, DatabuddyAgentClient } from "./agent-client";

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

	it("sends resolved org integration context to the Databuddy agent API", async () => {
		const originalFetch = globalThis.fetch;
		const captured: { body?: unknown; headers?: Headers; url?: string } = {};
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
				captured.url = request.url;
				return Response.json({ answer: "Done" });
			},
			{ preconnect: originalFetch.preconnect }
		);
		globalThis.fetch = fetchMock;

		try {
			const client = new DatabuddyAgentClient(
				{
					apiUrl: "http://api.test",
				},
				{
					resolve: async () => ({
						agentApiKeySecret: "dbdy_secret",
						organizationId: "org_123",
						teamId: "T123",
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
			expect(captured.url).toBe("http://api.test/v1/agent/ask");
			if (!captured.headers) {
				throw new Error("Expected the agent client to call fetch");
			}
			expect(captured.headers.get("authorization")).toBe("Bearer dbdy_secret");
			expect(captured.headers.has("x-databuddy-api-key-id")).toBe(false);
			expect(captured.headers.has("x-databuddy-internal-secret")).toBe(false);
			expect(captured.headers.get("x-databuddy-slack-organization-id")).toBe(
				"org_123"
			);
			expect(captured.headers.get("x-databuddy-slack-team-id")).toBe("T123");
			expect(captured.body).toMatchObject({
				question: "Summarize traffic",
				stream: true,
				timezone: "UTC",
			});
			expect(captured.body).not.toHaveProperty("websiteId");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("reads text stream responses from the Databuddy agent API", async () => {
		const originalFetch = globalThis.fetch;
		const encoder = new TextEncoder();
		const fetchMock = Object.assign(
			async () =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(encoder.encode("Hello "));
							controller.enqueue(encoder.encode("from stream"));
							controller.close();
						},
					}),
					{
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					}
				),
			{ preconnect: originalFetch.preconnect }
		);
		globalThis.fetch = fetchMock;

		try {
			const client = new DatabuddyAgentClient(
				{
					apiUrl: "http://api.test",
				},
				{
					resolve: async () => ({
						agentApiKeySecret: "dbdy_secret",
						organizationId: "org_123",
						teamId: "T123",
					}),
				}
			);

			const chunks: string[] = [];
			for await (const chunk of client.stream({
				channelId: "C123",
				teamId: "T123",
				text: "Summarize traffic",
				trigger: "direct_message",
				userId: "U123",
			})) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Hello ", "from stream"]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("explains missing organization context when no Slack installation resolves", async () => {
		const client = new DatabuddyAgentClient(
			{
				apiUrl: "http://api.test",
			},
			{
				resolve: async () => null,
			}
		);

		const answer = await client.runToText({
			channelId: "C123",
			teamId: "T123",
			text: "Summarize traffic",
			trigger: "direct_message",
			userId: "U123",
		});

		expect(answer).toBe(
			"Databuddy is not connected to this Slack workspace yet. Open Databuddy organization settings -> Integrations -> Slack, connect the workspace, then run `/bind` in this channel."
		);
	});

	it("does not include agent response bodies in thrown errors", async () => {
		const originalFetch = globalThis.fetch;
		const fetchMock = Object.assign(
			async () =>
				new Response("database password leaked into an upstream error", {
					status: 500,
					statusText: "Internal Server Error",
				}),
			{ preconnect: originalFetch.preconnect }
		);
		globalThis.fetch = fetchMock;

		try {
			const client = new DatabuddyAgentClient(
				{
					apiUrl: "http://api.test",
				},
				{
					resolve: async () => ({
						agentApiKeySecret: "dbdy_secret",
						organizationId: "org_123",
						teamId: "T123",
					}),
				}
			);

			let thrown: unknown;
			try {
				await client.runToText({
					channelId: "C123",
					teamId: "T123",
					text: "Summarize traffic",
					trigger: "direct_message",
					userId: "U123",
				});
			} catch (error) {
				thrown = error;
			}

			expect(thrown).toBeInstanceOf(Error);
			expect((thrown as Error).message).toBe(
				"Databuddy agent API returned 500 Internal Server Error"
			);
			expect((thrown as Error).message).not.toContain("database password");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
