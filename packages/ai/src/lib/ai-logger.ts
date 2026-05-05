import type { AILogger } from "evlog/ai";
import { createAILogger } from "evlog/ai";
import { createRequestLogger } from "evlog";
import { useLogger as getRequestLogger } from "evlog/elysia";

export function getAILogger(): AILogger {
	try {
		return createAILogger(getRequestLogger(), {
			toolInputs: { maxLength: 500 },
		});
	} catch {
		return createAILogger(createRequestLogger(), {
			toolInputs: { maxLength: 500 },
		});
	}
}
