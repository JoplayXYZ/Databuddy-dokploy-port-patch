import "./tools.test-env";

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { McpRequestContext } from "./define-tool";
import { createMcpTools } from "./tools";

const ctx: McpRequestContext = {
	apiKey: null,
	requestHeaders: new Headers(),
	userId: null,
};

const tools = createMcpTools(ctx);

describe("MCP tools/list JSON Schema rendering", () => {
	test("registers at least one tool", () => {
		expect(tools.length).toBeGreaterThan(0);
	});

	for (const tool of tools) {
		test(`${tool.name}: inputSchema renders to JSON Schema`, () => {
			expect(() =>
				z.toJSONSchema(tool.inputSchema, { io: "input" })
			).not.toThrow();
		});

		if (tool.outputSchema) {
			test(`${tool.name}: outputSchema renders to JSON Schema`, () => {
				const outputSchema = tool.outputSchema;
				if (!outputSchema) {
					return;
				}
				expect(() =>
					z.toJSONSchema(outputSchema, { io: "output" })
				).not.toThrow();
			});
		}
	}
});
