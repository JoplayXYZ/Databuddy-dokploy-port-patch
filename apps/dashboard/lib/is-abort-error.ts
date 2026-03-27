/** True when a fetch or query was cancelled (Strict Mode remount, navigation, etc.). */
export function isAbortError(error: unknown): boolean {
	if (error instanceof Error) {
		return error.name === "AbortError";
	}
	if (typeof DOMException !== "undefined" && error instanceof DOMException) {
		return error.name === "AbortError";
	}
	return false;
}
