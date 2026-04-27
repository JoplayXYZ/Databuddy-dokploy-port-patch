const TRAILING_SLASHES_PATTERN = /\/+$/;

export const STATUS_URL = (
	process.env.NEXT_PUBLIC_STATUS_URL || "https://status.databuddy.cc"
).replace(TRAILING_SLASHES_PATTERN, "");

export function getStatusPageUrl(slug: string): string {
	return `${STATUS_URL}/${slug}`;
}
