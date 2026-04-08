import { type Tool, tool } from "ai";
import { z } from "zod";
import {
	isMemoryEnabled,
	searchMemories,
	storeConversation,
} from "../../lib/supermemory";

const MAX_MEMORY_LENGTH = 2000;

/**
 * Sanitize content before storing or returning memory to prevent
 * stored prompt injection (malicious payloads persisted and retrieved later).
 */
function sanitizeMemoryContent(value: string): string {
	let cleaned = value.slice(0, MAX_MEMORY_LENGTH);
	cleaned = cleaned.replace(/<\/?[a-z_][a-z_0-9-]*(?:\s[^>]*)?\s*\/?>/gi, "");
	return cleaned;
}

function getAgentContext(options: unknown): {
	userId: string | null;
	apiKeyId: string | null;
} {
	const ctx = (options as { experimental_context?: Record<string, unknown> })
		?.experimental_context;
	const userId =
		typeof ctx?.userId === "string" && ctx.userId ? ctx.userId : null;
	const apiKey = ctx?.apiKey as { id: string } | null | undefined;
	return { userId, apiKeyId: apiKey?.id ?? null };
}

export function createMemoryTools(): Record<string, Tool> {
	if (!isMemoryEnabled()) {
		return {};
	}

	return {
		search_memory: tool({
			description:
				"Search past conversation memory for this user's preferences, patterns, or prior findings.",
			strict: true,
			inputSchema: z.object({
				query: z.string(),
				limit: z.number().min(1).max(10).optional().default(5),
			}),
			execute: async (args, options) => {
				const { userId, apiKeyId } = getAgentContext(options);
				const results = await searchMemories(args.query, userId, apiKeyId, {
					limit: args.limit,
					threshold: 0.4,
				});

				if (results.length === 0) {
					return { found: false, message: "No relevant memories found." };
				}

				return {
					found: true,
					memories: results.map((r) => ({
						content: sanitizeMemoryContent(r.memory),
						relevance: Math.round(r.similarity * 100),
					})),
				};
			},
		}),
		save_memory: tool({
			description:
				"Save an important user preference, pattern, or finding for future conversations.",
			strict: true,
			inputSchema: z.object({
				content: z.string(),
				category: z
					.enum(["preference", "insight", "pattern", "alert", "context"])
					.optional()
					.default("insight"),
			}),
			execute: (args, options) => {
				const { userId, apiKeyId } = getAgentContext(options);
				const sanitized = sanitizeMemoryContent(args.content);
				storeConversation(
					[{ role: "assistant", content: sanitized }],
					userId,
					apiKeyId,
					{ category: args.category ?? "insight" }
				);
				return { saved: true };
			},
		}),
	};
}
