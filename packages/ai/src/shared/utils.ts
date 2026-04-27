import { v7 as uuidv7 } from "uuid";

const MAX_LENGTH = 100_000;
const DATA_URL_PATTERN = /^data:([^;,]+)/;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;
const WHITESPACE_PATTERN = /\s/;

/** Truncates text to a maximum length */
export function truncate(text: string, maxLength = MAX_LENGTH): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

/** Redacts base64 data URLs and raw base64 strings */
export function redactBase64(data: string): string {
	if (data.startsWith("data:")) {
		const match = data.match(DATA_URL_PATTERN);
		return `[${match?.[1] ?? "unknown"} data URL redacted]`;
	}

	if (
		data.length > 1000 &&
		!WHITESPACE_PATTERN.test(data) &&
		BASE64_PATTERN.test(data)
	) {
		return `[base64 data redacted - ${data.length} chars]`;
	}

	return data;
}

/** Extracts text content from various content formats */
export function extractText(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if (item && typeof item === "object" && "text" in item) {
					return (item as { text: string }).text;
				}
				return "";
			})
			.join("");
	}

	return "";
}

export function createTraceId(): string {
	return uuidv7();
}

/** Creates an error info object */
export function createErrorInfo(error: unknown): {
	name: string;
	message: string;
	stack?: string;
} {
	return {
		name: error instanceof Error ? error.name : "UnknownError",
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	};
}

/** Extracts HTTP status from an error */
export function getHttpStatus(error: unknown): number {
	if (error && typeof error === "object" && "status" in error) {
		const status = (error as { status: unknown }).status;
		if (typeof status === "number") {
			return status;
		}
	}
	return 500;
}
