export const ACTIONABLE_TRACKING_BLOCK_REASONS = [
	"origin_not_authorized",
	"origin_missing",
	"ip_not_authorized",
] as const;

export type ActionableTrackingBlockReason =
	(typeof ACTIONABLE_TRACKING_BLOCK_REASONS)[number];

const ACTIONABLE_REASON_SET = new Set<string>(
	ACTIONABLE_TRACKING_BLOCK_REASONS
);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const TRAILING_DOT_REGEX = /\.$/;

export function isActionableTrackingBlockReason(
	reason: string
): reason is ActionableTrackingBlockReason {
	return ACTIONABLE_REASON_SET.has(reason);
}

export function getTrackingBlockOriginHost(
	origin: string | null
): string | null {
	if (!origin?.trim()) {
		return null;
	}

	try {
		return new URL(origin).hostname
			.toLowerCase()
			.replace(TRAILING_DOT_REGEX, "");
	} catch {
		return origin.trim().toLowerCase().replace(TRAILING_DOT_REGEX, "");
	}
}

function isPrivateIpv4(host: string): boolean {
	const parts = host.split(".").map((part) => Number.parseInt(part, 10));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
		return false;
	}

	const [a, b] = parts;
	if (a === 10) {
		return true;
	}
	if (a === 127) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	return a === 172 && b >= 16 && b <= 31;
}

export function isIgnoredTrackingBlockOrigin(origin: string | null): boolean {
	const host = getTrackingBlockOriginHost(origin);
	if (!host) {
		return false;
	}

	return (
		host === "null" ||
		LOCAL_HOSTS.has(host) ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".webcontainer-api.io") ||
		isPrivateIpv4(host)
	);
}
