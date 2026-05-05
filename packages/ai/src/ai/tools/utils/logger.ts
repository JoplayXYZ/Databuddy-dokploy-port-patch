import { log } from "evlog";
import { useLogger as getRequestLogger } from "evlog/elysia";

/**
 * Request-scoped logger for AI tools (wide event via evlog).
 * Falls back to global `log` when no request scope is active (same pattern as mergeWideEvent).
 */
export function createToolLogger(toolName: string) {
	return {
		info: (message: string, context?: Record<string, unknown>) => {
			try {
				getRequestLogger().info(message, {
					aiTool: { name: toolName },
					...context,
				});
			} catch {
				log.info({ service: "api", aiTool: toolName, message, ...context });
			}
		},
		error: (message: string, context?: Record<string, unknown>) => {
			const err = new Error(message);
			try {
				getRequestLogger().error(err, {
					aiTool: { name: toolName },
					...context,
				});
			} catch {
				log.error({
					service: "api",
					aiTool: toolName,
					message,
					...context,
				});
			}
		},
		warn: (message: string, context?: Record<string, unknown>) => {
			try {
				getRequestLogger().warn(message, {
					aiTool: { name: toolName },
					...context,
				});
			} catch {
				log.warn({ service: "api", aiTool: toolName, message, ...context });
			}
		},
		debug: (message: string, context?: Record<string, unknown>) => {
			try {
				getRequestLogger().set({
					aiTool: { name: toolName, level: "debug", message, ...context },
				});
			} catch {
				log.info({
					service: "api",
					aiTool: toolName,
					level: "debug",
					message,
					...context,
				});
			}
		},
	};
}
