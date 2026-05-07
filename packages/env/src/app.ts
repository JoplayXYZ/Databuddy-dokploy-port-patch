// App-wide runtime config.
//
// To add or change a public URL, edit one entry in URLS:
// - cloud: default in production
// - local: default outside production
// - env: fallback order, first non-empty value wins
//
// Server code should import `config` from "@databuddy/env/app".
// Browser/client code should import `publicConfig` from "@databuddy/env/public".
const URLS = {
	api: {
		cloud: "https://api.databuddy.cc",
		local: "http://localhost:3001",
		env: ["API_URL", "NEXT_PUBLIC_API_URL"],
	},
	basket: {
		cloud: "https://basket.databuddy.cc",
		local: "http://localhost:4000",
		env: ["BASKET_URL", "NEXT_PUBLIC_BASKET_URL"],
	},
	dashboard: {
		cloud: "https://app.databuddy.cc",
		local: "http://localhost:3000",
		env: ["DASHBOARD_URL", "NEXT_PUBLIC_APP_URL", "APP_URL", "BETTER_AUTH_URL"],
	},
	status: {
		cloud: "https://status.databuddy.cc",
		local: "http://localhost:3002",
		env: ["STATUS_URL", "NEXT_PUBLIC_STATUS_URL"],
	},
} as const;

// Email sender defaults. Env fallback order works the same way as URLS.
const EMAIL = {
	alertsFrom: {
		default: "Databuddy <alerts@databuddy.cc>",
		env: ["ALERTS_EMAIL_FROM", "EMAIL_FROM"],
	},
	from: {
		default: "Databuddy <no-reply@databuddy.cc>",
		env: ["EMAIL_FROM"],
	},
} as const;

const TRAILING_SLASH = /\/$/;

type Env = Record<string, string | undefined>;
type UrlConfig = (typeof URLS)[keyof typeof URLS];
type EmailConfig = (typeof EMAIL)[keyof typeof EMAIL];

export interface Config {
	email: {
		alertsFrom: string;
		from: string;
	};
	urls: {
		api: string;
		basket: string;
		dashboard: string;
		status: string;
	};
}

function isProduction(env: Env): boolean {
	return env.NODE_ENV === "production";
}

function defaultUrl(env: Env, setting: UrlConfig): string {
	return isProduction(env) ? setting.cloud : setting.local;
}

function isLocalhost(url: URL): boolean {
	return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function readFirst(env: Env, keys: readonly string[]): string | undefined {
	return keys.map((key) => env[key]?.trim()).find(Boolean);
}

function normalizeUrl(value: string): string {
	return new URL(value).toString().replace(TRAILING_SLASH, "");
}

function readUrl(env: Env, setting: UrlConfig): string {
	const fallback = defaultUrl(env, setting);
	const value = readFirst(env, setting.env);
	if (!value) {
		return fallback;
	}

	const normalized = normalizeUrl(value);
	if (isProduction(env) && isLocalhost(new URL(normalized))) {
		return fallback;
	}

	return normalized;
}

function readEmail(env: Env, setting: EmailConfig): string {
	return readFirst(env, setting.env) ?? setting.default;
}

export function createConfig(env: Env = process.env): Config {
	return {
		email: {
			alertsFrom: readEmail(env, EMAIL.alertsFrom),
			from: readEmail(env, EMAIL.from),
		},
		urls: {
			api: readUrl(env, URLS.api),
			basket: readUrl(env, URLS.basket),
			dashboard: readUrl(env, URLS.dashboard),
			status: readUrl(env, URLS.status),
		},
	};
}

export const config = createConfig();
