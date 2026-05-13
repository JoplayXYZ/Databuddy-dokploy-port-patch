export interface WebsiteSecuritySettings {
	allowedIps?: string[];
	allowedOrigins?: string[];
}

function setList(
	settings: WebsiteSecuritySettings,
	key: keyof WebsiteSecuritySettings,
	value: string[] | undefined
) {
	if (value === undefined) {
		return;
	}
	if (value.length === 0) {
		delete settings[key];
		return;
	}
	settings[key] = value;
}

function hasOwnSetting(
	settings: WebsiteSecuritySettings,
	key: keyof WebsiteSecuritySettings
): boolean {
	return Object.hasOwn(settings, key);
}

export function mergeWebsiteSecuritySettings(
	current: WebsiteSecuritySettings | null | undefined,
	patch: WebsiteSecuritySettings
): WebsiteSecuritySettings | null {
	const hasOrigins = hasOwnSetting(patch, "allowedOrigins");
	const hasIps = hasOwnSetting(patch, "allowedIps");

	if (!(hasOrigins || hasIps)) {
		return current ?? null;
	}

	const next: WebsiteSecuritySettings = { ...(current ?? {}) };

	if (hasOrigins) {
		setList(next, "allowedOrigins", patch.allowedOrigins);
	}

	if (hasIps) {
		setList(next, "allowedIps", patch.allowedIps);
	}

	return next.allowedOrigins?.length || next.allowedIps?.length ? next : null;
}
