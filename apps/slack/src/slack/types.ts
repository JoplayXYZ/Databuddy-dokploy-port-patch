import type { WebClient } from "@slack/web-api";

export interface SlackSlashCommand {
	channel_id: string;
	team_id?: string;
	user_id?: string;
}

export interface SlackLogger {
	error(...args: unknown[]): void;
	warn(...args: unknown[]): void;
}

export type SlackSlashRespond = (message: {
	response_type: "ephemeral";
	text: string;
}) => Promise<unknown>;

export type SlackAgentClient = Pick<WebClient, "apiCall" | "reactions">;

export type SlackSay = (message: {
	text: string;
	thread_ts?: string;
}) => Promise<unknown>;
