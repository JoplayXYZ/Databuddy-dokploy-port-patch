import { z } from "zod";
import { createEnv } from "./base";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const booleanFromEnv = z.preprocess((value) => {
	if (value === undefined || value === "") {
		return;
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		return ["1", "true", "yes", "on"].includes(value.toLowerCase());
	}
	return value;
}, z.boolean().default(true));

const slackEnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	SLACK_APP_ID: optionalString,
	SLACK_APP_TOKEN: optionalString,
	SLACK_APP_CONFIG_TOKEN: optionalString,
	SLACK_SIGNING_SECRET: optionalString,
	SLACK_SOCKET_MODE: booleanFromEnv,
	SLACK_PORT: z.coerce.number().int().positive().default(3010),
	SLACK_EVLOG_FS: optionalString,
	SLACK_LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
	DATABUDDY_API_URL: z.string().url().default("http://localhost:3001"),
	DATABUDDY_ENCRYPTION_KEY: optionalString,
});

export const env = createEnv(slackEnvSchema, {
	skipValidation: process.env.SKIP_VALIDATION === "true",
});

export type SlackEnv = typeof env;
