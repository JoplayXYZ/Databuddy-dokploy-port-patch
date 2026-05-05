import { isValid, parse } from "ipaddr.js";
import { resolve4, resolve6 } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"metadata.google.internal",
	"metadata.google",
	"169.254.169.254",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateOrReserved(ip: string): boolean {
	try {
		const parsed = parse(ip);
		const range = parsed.range();
		return range !== "unicast";
	} catch {
		return true;
	}
}

export async function validateUrl(url: string): Promise<{
	safe: boolean;
	hostname: string;
	error?: string;
}> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { safe: false, hostname: "", error: "Invalid URL" };
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		return {
			safe: false,
			hostname: parsed.hostname,
			error: "Invalid protocol",
		};
	}

	const hostname = parsed.hostname.toLowerCase();

	if (BLOCKED_HOSTNAMES.has(hostname)) {
		return { safe: false, hostname, error: "Blocked hostname" };
	}

	for (const suffix of BLOCKED_SUFFIXES) {
		if (hostname.endsWith(suffix)) {
			return { safe: false, hostname, error: "Blocked hostname suffix" };
		}
	}

	if (isValid(hostname)) {
		if (isPrivateOrReserved(hostname)) {
			return { safe: false, hostname, error: "Private IP address" };
		}
		return { safe: true, hostname };
	}

	const v4Result = await resolve4(hostname).catch(() => [] as string[]);
	const v6Result = await resolve6(hostname).catch(() => [] as string[]);
	const allAddresses = [...v4Result, ...v6Result];

	if (allAddresses.length === 0) {
		return { safe: false, hostname, error: "DNS resolution failed" };
	}

	for (const addr of allAddresses) {
		if (isPrivateOrReserved(addr)) {
			return {
				safe: false,
				hostname,
				error: `Resolves to private IP: ${addr}`,
			};
		}
	}

	return { safe: true, hostname };
}
