import { parseError } from "evlog";

interface AppErrorContext {
	code?: string | number;
	error: unknown;
}

export function handleAppError({ error, code }: AppErrorContext) {
	const statusCode = code === "NOT_FOUND" || code === 404 ? 404 : 500;
	const errorCode = code == null ? "INTERNAL_SERVER_ERROR" : String(code);
	const parsed = parseError(error);
	const isDevelopment = process.env.NODE_ENV === "development";
	const errorMessage = error instanceof Error ? error.message : String(error);
	const safeClientError =
		isDevelopment || statusCode === 404
			? errorMessage
			: "An internal server error occurred";
	const exposeStructured =
		isDevelopment || (parsed.status >= 400 && parsed.status < 500);

	return new Response(
		JSON.stringify({
			success: false,
			error: safeClientError,
			code: errorCode,
			...(hasValue(parsed.why) && exposeStructured ? { why: parsed.why } : {}),
			...(hasValue(parsed.fix) && exposeStructured ? { fix: parsed.fix } : {}),
			...(hasValue(parsed.link) && exposeStructured
				? { link: parsed.link }
				: {}),
		}),
		{ status: statusCode, headers: { "Content-Type": "application/json" } }
	);
}

function hasValue(value: unknown): value is string {
	return typeof value === "string" && value !== "";
}
