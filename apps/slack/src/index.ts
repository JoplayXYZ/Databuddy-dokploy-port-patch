import { App } from "@slack/bolt";
import { DatabuddyAgentClient } from "./agent/agent-client";
import { resolveSlackConfig } from "./config";
import {
	createSlackAuthorize,
	SlackInstallationStore,
} from "./slack/installations";
import { registerSlackListeners } from "./slack/listeners";

const config = resolveSlackConfig();

if (!config.enabled) {
	console.info(`[slack] disabled: ${config.reason}`);
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
} catch (error) {
	console.error("[slack] failed to start", error);
	process.exit(1);
}
