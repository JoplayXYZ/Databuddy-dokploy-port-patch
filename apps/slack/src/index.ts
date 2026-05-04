import { App } from "@slack/bolt";
import { initLogger, log } from "evlog";
import { DatabuddyAgentClient } from "./agent/agent-client";
import { resolveSlackConfig } from "./config";
import {
	captureSlackError,
	flushBatchedSlackDrain,
	slackLoggerDrain,
} from "./lib/evlog-slack";
import {
	createSlackAuthorize,
	SlackInstallationStore,
} from "./slack/installations";
import { registerSlackListeners } from "./slack/listeners";

initLogger({
	env: { service: "slack" },
	drain: slackLoggerDrain,
	sampling: {},
});

process.on("unhandledRejection", (reason) => {
	captureSlackError(reason, { process: "unhandledRejection" });
});

process.on("uncaughtException", (error) => {
	captureSlackError(error, { process: "uncaughtException" });
});

const config = resolveSlackConfig();

if (!config.enabled) {
	log.info({ lifecycle: "disabled", reason: config.reason });
	await flushBatchedSlackDrain();
	process.exit(0);
}

const installations = new SlackInstallationStore(config.crypto);

const app = new App({
	appToken: config.appToken,
	authorize: createSlackAuthorize(installations),
	clientOptions: {
		slackApiUrl: "https://slack.com/api",
	},
	logLevel: config.logLevel,
	signingSecret: config.signingSecret,
	socketMode: config.socketMode,
});

registerSlackListeners(
	app,
	new DatabuddyAgentClient(config.agent, installations),
	installations
);

try {
	if (config.socketMode) {
		await app.start();
	} else {
		await app.start(config.port);
	}
	console.info(
		config.socketMode
			? "[slack] Databuddy bot is running in Socket Mode"
			: `[slack] Databuddy bot is listening on port ${config.port}`
	);
	log.info({
		lifecycle: "started",
		slack_socket_mode: config.socketMode,
		...(config.socketMode ? {} : { slack_port: config.port }),
	});
} catch (error) {
	captureSlackError(error, { lifecycle: "start_failed" });
	await flushBatchedSlackDrain();
	process.exit(1);
}

async function shutdown(signal: string) {
	log.info({ lifecycle: "shutdown", signal });
	await Promise.all([
		app
			.stop()
			.catch((error) =>
				captureSlackError(error, { lifecycle: "slack_stop_failed" })
			),
		flushBatchedSlackDrain().catch((error) =>
			captureSlackError(error, { lifecycle: "drain_flush_failed" })
		),
	]);
	process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
