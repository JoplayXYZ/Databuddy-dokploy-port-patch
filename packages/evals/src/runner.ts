import type {
	EvalCase,
	EvalConfig,
	ParsedAgentResponse,
	ToolCallRecord,
} from "./types";

export type ProgressEvent =
	| { kind: "step"; step: number }
	| { kind: "tool"; name: string; index: number }
	| { kind: "text"; chars: number }
	| { kind: "done" };

export async function runCase(
	evalCase: EvalCase,
	config: EvalConfig,
	onProgress?: (evt: ProgressEvent) => void
): Promise<ParsedAgentResponse> {
	const startTime = Date.now();

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (config.authCookie) {
		headers.Cookie = config.authCookie;
	}
	if (config.apiKey) {
		headers["x-api-key"] = config.apiKey;
	}
	if (config.modelOverride) {
		headers["x-model-override"] = config.modelOverride;
	}

	const body = JSON.stringify({
		websiteId: evalCase.websiteId,
		id: `eval-${evalCase.id}-${Date.now()}`,
		timezone: "UTC",
		messages: [
			{
				id: `msg-${Date.now()}`,
				role: "user",
				parts: [{ type: "text", text: evalCase.query }],
			},
		],
	});

	const response = await fetch(`${config.apiUrl}/v1/agent/chat`, {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Agent API error ${response.status}: ${errorText}`);
	}

	return streamSSE(response, startTime, onProgress);
}

async function streamSSE(
	response: Response,
	startTime: number,
	onProgress?: (evt: ProgressEvent) => void
): Promise<ParsedAgentResponse> {
	const toolCalls: ToolCallRecord[] = [];
	let pendingToolCall: Omit<ToolCallRecord, "output"> | null = null;
	let textContent = "";
	let inputTokens = 0;
	let outputTokens = 0;
	let steps = 0;

	if (!response.body) {
		throw new Error("Agent API response did not include a body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";

	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buf += decoder.decode(value, { stream: true });

		let newlineIdx = buf.indexOf("\n");
		while (newlineIdx !== -1) {
			const line = buf.slice(0, newlineIdx);
			buf = buf.slice(newlineIdx + 1);

			if (!line.startsWith("data: ")) {
				newlineIdx = buf.indexOf("\n");
				continue;
			}
			const payload = line.slice(6).trim();
			if (payload === "[DONE]") {
				onProgress?.({ kind: "done" });
				break;
			}

			let evt: Record<string, unknown>;
			try {
				evt = JSON.parse(payload);
			} catch {
				newlineIdx = buf.indexOf("\n");
				continue;
			}

			switch (evt.type) {
				case "tool-input-available":
					if (typeof evt.toolName === "string") {
						if (pendingToolCall) {
							toolCalls.push({ ...pendingToolCall, output: null });
						}
						pendingToolCall = {
							index: toolCalls.length,
							name: evt.toolName,
							input: evt.input ?? null,
						};
						onProgress?.({
							kind: "tool",
							name: evt.toolName,
							index: toolCalls.length,
						});
					}
					break;
				case "tool-output-available":
					if (pendingToolCall) {
						toolCalls.push({
							...pendingToolCall,
							output: evt.output ?? null,
						});
						pendingToolCall = null;
					}
					break;
				case "text-delta":
				case "content-delta":
					if (typeof evt.delta === "string") {
						textContent += evt.delta;
						onProgress?.({ kind: "text", chars: textContent.length });
					}
					break;
				case "step-finish":
					if (evt.usage) {
						const u = evt.usage as Record<string, number>;
						const iT = u.inputTokens ?? u.prompt_tokens ?? 0;
						const oT = u.outputTokens ?? u.completion_tokens ?? 0;
						if (iT > 0) {
							inputTokens += iT;
						}
						if (oT > 0) {
							outputTokens += oT;
						}
					}
					break;
				case "finish":
					if (evt.usage && inputTokens === 0) {
						const u = evt.usage as Record<string, number>;
						inputTokens = u.inputTokens ?? u.prompt_tokens ?? 0;
						outputTokens = u.outputTokens ?? u.completion_tokens ?? 0;
					}
					break;
				case "start-step":
					steps++;
					onProgress?.({ kind: "step", step: steps });
					break;
				default:
					break;
			}
			newlineIdx = buf.indexOf("\n");
		}
	}

	if (pendingToolCall) {
		toolCalls.push({ ...pendingToolCall, output: null });
	}

	const latencyMs = Date.now() - startTime;

	const chartJSONs: ParsedAgentResponse["chartJSONs"] = [];
	const rawJSONLeaks: string[] = [];
	let searchIdx = 0;
	while (searchIdx < textContent.length) {
		const start = textContent.indexOf('{"type":"', searchIdx);
		if (start === -1) {
			break;
		}

		let depth = 0;
		let end = -1;
		for (let i = start; i < textContent.length; i++) {
			if (textContent[i] === "{") {
				depth++;
			} else if (textContent[i] === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) {
			break;
		}

		const jsonStr = textContent.slice(start, end + 1);
		try {
			const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
			if (typeof parsed.type === "string") {
				chartJSONs.push({ type: parsed.type, raw: jsonStr, parsed });
			}
		} catch {
			rawJSONLeaks.push(jsonStr.slice(0, 100));
		}
		searchIdx = end + 1;
	}

	return {
		textContent,
		toolCalls,
		chartJSONs,
		rawJSONLeaks,
		steps,
		latencyMs,
		inputTokens,
		outputTokens,
	};
}
