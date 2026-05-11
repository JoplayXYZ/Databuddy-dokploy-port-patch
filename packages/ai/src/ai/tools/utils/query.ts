import { chQuery } from "@databuddy/db/clickhouse";
import { stripHtmlTags } from "../../../lib/sanitize";
import { createToolLogger } from "./logger";

export interface QueryResult<T = unknown> {
	data: T[];
	executionTime: number;
	rowCount: number;
}

const USER_CONTENT_FIELDS = new Set([
	"path",
	"title",
	"referrer",
	"message",
	"stack",
	"filename",
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"event_name",
	"property_key",
	"property_value",
]);

const MAX_STRING_LENGTH = 2000;

function sanitizeValue(value: string): string {
	return stripHtmlTags(value, MAX_STRING_LENGTH);
}

function sanitizeRow<T extends Record<string, unknown>>(row: T): T {
	const out = { ...row };
	for (const key of Object.keys(out)) {
		if (USER_CONTENT_FIELDS.has(key) && typeof out[key] === "string") {
			(out as Record<string, unknown>)[key] = sanitizeValue(out[key] as string);
		}
	}
	return out;
}

/**
 * Executes a timed ClickHouse query with logging.
 * Sanitizes user-controlled string fields in results to reduce indirect
 * prompt injection surface.
 */
export async function executeTimedQuery<T extends Record<string, unknown>>(
	toolName: string,
	sql: string,
	params: Record<string, unknown> = {},
	logContext?: Record<string, unknown>,
	clickhouseSettings?: Record<string, string | number>
): Promise<QueryResult<T>> {
	const logger = createToolLogger(toolName);
	const queryStart = Date.now();

	try {
		const raw = await chQuery<T>(sql, params, {
			readonly: true,
			...(clickhouseSettings && { clickhouse_settings: clickhouseSettings }),
		});
		const executionTime = Date.now() - queryStart;
		const result = raw.map(sanitizeRow);

		logger.info("Query completed", {
			...logContext,
			executionTime: `${executionTime}ms`,
			rowCount: result.length,
			sql: `${sql.slice(0, 100)}${sql.length > 100 ? "..." : ""}`,
		});

		return {
			data: result,
			executionTime,
			rowCount: result.length,
		};
	} catch (error) {
		const executionTime = Date.now() - queryStart;

		logger.error("Query failed", {
			...logContext,
			executionTime: `${executionTime}ms`,
			error: error instanceof Error ? error.message : "Unknown error",
			sql: `${sql.slice(0, 100)}${sql.length > 100 ? "..." : ""}`,
		});

		throw error;
	}
}
