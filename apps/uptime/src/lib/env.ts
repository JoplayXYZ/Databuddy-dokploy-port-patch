const environment =
	process.env.UNKEY_ENVIRONMENT_SLUG ??
	(process.env.NODE_ENV === "development" ? "development" : "production");

export const UPTIME_ENV = {
	environment,
	isDev: process.env.NODE_ENV === "development",
	isProduction: environment === "production",
} as const;
