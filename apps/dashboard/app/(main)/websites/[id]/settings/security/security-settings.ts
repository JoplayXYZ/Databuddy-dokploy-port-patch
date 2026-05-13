export interface SecuritySettingsDraft {
	allowedIps: string[];
	allowedOrigins: string[];
}

function readStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function sameList(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function readSecuritySettings(settings: unknown): SecuritySettingsDraft {
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
		return { allowedIps: [], allowedOrigins: [] };
	}

	const record = settings as Record<string, unknown>;
	return {
		allowedIps: readStringList(record.allowedIps),
		allowedOrigins: readStringList(record.allowedOrigins),
	};
}

export function createSecuritySettingsPayload(
	settings: SecuritySettingsDraft
): SecuritySettingsDraft {
	return {
		allowedIps: [...settings.allowedIps],
		allowedOrigins: [...settings.allowedOrigins],
	};
}

export function areSecuritySettingsEqual(
	a: SecuritySettingsDraft,
	b: SecuritySettingsDraft
): boolean {
	return (
		sameList(a.allowedOrigins, b.allowedOrigins) &&
		sameList(a.allowedIps, b.allowedIps)
	);
}

export function normalizeSecurityTag(value: string): string {
	return value.trim().toLowerCase();
}
