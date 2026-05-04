import { and, db, eq, ilike, or } from "@databuddy/db";
import {
	slackChannelBindings,
	slackIntegrations,
	websites,
} from "@databuddy/db/schema";
import { decrypt } from "@databuddy/encryption";
import type { Authorize } from "@slack/bolt";
import { randomUUIDv7 } from "bun";
import type {
	SlackAgentRun,
	SlackRunContext,
	SlackRunContextResolver,
} from "../agent/agent-client";
import type { TokenCryptoConfig } from "../config";

const LEADING_WWW_REGEX = /^www\./;

export interface SlackChannelBindingCommand {
	channelId: string;
	selector?: string;
	teamId?: string;
}

export interface SlackChannelBindingCommandResult {
	message: string;
	ok: boolean;
}

export class SlackInstallationStore implements SlackRunContextResolver {
	readonly #crypto: TokenCryptoConfig;

	constructor(crypto: TokenCryptoConfig) {
		this.#crypto = crypto;
	}

	async authorize(teamId: string) {
		const installation = await findActiveIntegration(teamId);
		if (!installation) {
			throw new Error(`Slack team ${teamId} is not connected to Databuddy`);
		}

		return {
			botId: installation.botId ?? undefined,
			botToken: decrypt(
				installation.botTokenCiphertext,
				this.#crypto.encryptionKey
			),
			botUserId: installation.botUserId ?? undefined,
			teamId,
		};
	}

	async resolve(run: SlackAgentRun): Promise<SlackRunContext | null> {
		if (!run.teamId) {
			return null;
		}

		const installation = await findActiveIntegration(run.teamId);
		if (!installation) {
			return null;
		}

		const [channelBinding] = await db
			.select({ websiteId: slackChannelBindings.websiteId })
			.from(slackChannelBindings)
			.where(
				and(
					eq(slackChannelBindings.integrationId, installation.id),
					eq(slackChannelBindings.slackChannelId, run.channelId)
				)
			)
			.limit(1);
		const websiteId =
			channelBinding?.websiteId ?? installation.defaultWebsiteId;
		if (!websiteId) {
			return null;
		}

		const [website] = await db
			.select({ id: websites.id })
			.from(websites)
			.where(
				and(
					eq(websites.id, websiteId),
					eq(websites.organizationId, installation.organizationId)
				)
			)
			.limit(1);
		if (!website) {
			return null;
		}

		return {
			agentApiKeySecret: decrypt(
				installation.agentApiKeyCiphertext,
				this.#crypto.encryptionKey
			),
			organizationId: installation.organizationId,
			teamId: installation.teamId,
			websiteId: website.id,
		};
	}

	async bindChannel({
		channelId,
		selector,
		teamId,
	}: SlackChannelBindingCommand): Promise<SlackChannelBindingCommandResult> {
		if (!teamId) {
			return {
				message: "Slack did not include a workspace id for this command.",
				ok: false,
			};
		}

		const installation = await findActiveIntegration(teamId);
		if (!installation) {
			return {
				message:
					"This Slack workspace is not connected to a Databuddy organization yet.",
				ok: false,
			};
		}

		const website = await findWebsiteForBinding({
			defaultWebsiteId: installation.defaultWebsiteId,
			organizationId: installation.organizationId,
			selector,
		});
		if (!website) {
			return {
				message: selector
					? `I could not find a Databuddy website matching "${selector}".`
					: "Set a default website in Databuddy first, or run `/databuddy bind your-domain.com`.",
				ok: false,
			};
		}

		const now = new Date();
		await db
			.insert(slackChannelBindings)
			.values({
				createdAt: now,
				id: randomUUIDv7(),
				integrationId: installation.id,
				slackChannelId: channelId,
				updatedAt: now,
				websiteId: website.id,
			})
			.onConflictDoUpdate({
				set: { updatedAt: now, websiteId: website.id },
				target: [
					slackChannelBindings.integrationId,
					slackChannelBindings.slackChannelId,
				],
			});

		return {
			message: `This channel is now bound to ${websiteLabel(website)}.`,
			ok: true,
		};
	}

	async unbindChannel({
		channelId,
		teamId,
	}: SlackChannelBindingCommand): Promise<SlackChannelBindingCommandResult> {
		if (!teamId) {
			return {
				message: "Slack did not include a workspace id for this command.",
				ok: false,
			};
		}

		const installation = await findActiveIntegration(teamId);
		if (!installation) {
			return {
				message:
					"This Slack workspace is not connected to a Databuddy organization yet.",
				ok: false,
			};
		}

		const deleted = await db
			.delete(slackChannelBindings)
			.where(
				and(
					eq(slackChannelBindings.integrationId, installation.id),
					eq(slackChannelBindings.slackChannelId, channelId)
				)
			)
			.returning({ id: slackChannelBindings.id });

		return deleted.length > 0
			? {
					message:
						"This channel binding was removed. The default website will be used instead.",
					ok: true,
				}
			: {
					message: "This channel did not have a Databuddy binding.",
					ok: true,
				};
	}
}

export function createSlackAuthorize(
	installations: SlackInstallationStore
): Authorize<boolean> {
	return async ({ teamId }) => {
		if (!teamId) {
			throw new Error("Slack authorize source did not include a team id");
		}
		return await installations.authorize(teamId);
	};
}

function findActiveIntegration(teamId: string) {
	return db
		.select({
			id: slackIntegrations.id,
			agentApiKeyCiphertext: slackIntegrations.agentApiKeyCiphertext,
			botId: slackIntegrations.botId,
			botTokenCiphertext: slackIntegrations.botTokenCiphertext,
			botUserId: slackIntegrations.botUserId,
			defaultWebsiteId: slackIntegrations.defaultWebsiteId,
			organizationId: slackIntegrations.organizationId,
			teamId: slackIntegrations.teamId,
		})
		.from(slackIntegrations)
		.where(
			and(
				eq(slackIntegrations.teamId, teamId),
				eq(slackIntegrations.status, "active")
			)
		)
		.limit(1)
		.then(([installation]) => installation ?? null);
}

function normalizeWebsiteSelector(selector: string): string {
	const value = selector.trim();
	if (!value) {
		return "";
	}
	try {
		const url = new URL(value.includes("://") ? value : `https://${value}`);
		return url.hostname.replace(LEADING_WWW_REGEX, "");
	} catch {
		return value.replace(LEADING_WWW_REGEX, "");
	}
}

async function findWebsiteForBinding({
	defaultWebsiteId,
	organizationId,
	selector,
}: {
	defaultWebsiteId: string | null;
	organizationId: string;
	selector?: string;
}) {
	const normalizedSelector = selector ? normalizeWebsiteSelector(selector) : "";
	const rawSelector = selector?.trim() ?? normalizedSelector;
	const where = normalizedSelector
		? and(
				eq(websites.organizationId, organizationId),
				or(
					eq(websites.id, rawSelector),
					ilike(websites.domain, normalizedSelector),
					ilike(websites.domain, `www.${normalizedSelector}`),
					ilike(websites.name, rawSelector)
				)
			)
		: defaultWebsiteId
			? and(
					eq(websites.organizationId, organizationId),
					eq(websites.id, defaultWebsiteId)
				)
			: undefined;

	if (!where) {
		return null;
	}

	const [website] = await db
		.select({ domain: websites.domain, id: websites.id, name: websites.name })
		.from(websites)
		.where(where)
		.limit(1);

	return website ?? null;
}

function websiteLabel(website: {
	domain: string | null;
	name: string | null;
}): string {
	return website.name?.trim() || website.domain || "selected website";
}
