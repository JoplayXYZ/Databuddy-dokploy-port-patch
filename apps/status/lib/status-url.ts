export const STATUS_URL = (
	process.env.NEXT_PUBLIC_STATUS_URL || "https://status.databuddy.cc"
).replace(/\/+$/, "");

export const DATABUDDY_URL = "https://www.databuddy.cc";
export const DATABUDDY_UPTIME_URL = `${DATABUDDY_URL}/uptime`;

export function getStatusPageUrl(slug: string): string {
	return `${STATUS_URL}/${slug}`;
}
