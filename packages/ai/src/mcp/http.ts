import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { captureError, mergeWideEvent } from "../lib/tracing";
import type {
	McpRequestContext,
	RegisteredMcpTool,
} from "../ai/mcp/define-tool";
import { createMcpTools } from "../ai/mcp/tools";

const DEFAULT_MCP_SERVER_NAME = "databuddy";
const DEFAULT_MCP_SERVER_VERSION = "1.0.0";

export interface DatabuddyMcpHttpOptions extends McpRequestContext {
	request: Request;
	serverName?: string;
	serverVersion?: string;
}

export async function createMcpUnauthorizedResponse(
	request: Request
): Promise<Response> {
	mergeWideEvent({ mcp_auth: "unauthorized" });

	return Response.json(
		{
			jsonrpc: "2.0",
			error: {
				code: -32_001,
				message:
					"Authentication required. Use x-api-key or Authorization: Bearer with a key that has read:data scope.",
			},
			id: await readJsonRpcId(request),
		},
		{
			status: 401,
			headers: {
				"WWW-Authenticate":
					'Bearer realm="databuddy", error="invalid_token", error_description="API key required (x-api-key or Authorization: Bearer)"',
			},
		}
	);
}

export async function handleDatabuddyMcpRequest(
	options: DatabuddyMcpHttpOptions
): Promise<Response> {
	mergeWideEvent({
		mcp_auth: options.userId ? "session" : "api_key",
		mcp_session: Boolean(options.userId),
		mcp_api_key: Boolean(options.apiKey),
	});

	const server = new McpServer(
		{
			name: options.serverName ?? DEFAULT_MCP_SERVER_NAME,
			version: options.serverVersion ?? DEFAULT_MCP_SERVER_VERSION,
		},
		{ capabilities: { tools: {} } }
	);

	for (const tool of createMcpTools(options)) {
		registerTool(server, tool);
	}

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	try {
		await server.connect(transport);
		return await transport.handleRequest(options.request);
	} catch (error) {
		captureError(error, { mcp_error: true });
		throw error;
	} finally {
		await server.close().catch(() => {});
	}
}

function registerTool(server: McpServer, tool: RegisteredMcpTool): void {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: toMcpSchema(tool.inputSchema),
			...(tool.outputSchema && {
				outputSchema: toMcpSchema(tool.outputSchema),
			}),
		},
		tool.handler
	);
}

function toMcpSchema(schema: RegisteredMcpTool["inputSchema"]): AnySchema {
	// The MCP SDK's zod-compat type targets a different Zod surface than this repo's Zod v4 types.
	return schema as unknown as AnySchema;
}

async function readJsonRpcId(
	request: Request
): Promise<string | number | null> {
	try {
		const body = (await request.clone().json()) as { id?: unknown };
		return typeof body.id === "string" || typeof body.id === "number"
			? body.id
			: null;
	} catch {
		return null;
	}
}
