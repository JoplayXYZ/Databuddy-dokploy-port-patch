import { and, db, eq } from "@databuddy/db";
import {
	slackChannelBindings,
	slackIntegrations,
	websites,
} from "@databuddy/db/schema";
import type { Authorize } from "@slack/bolt";
import type {
	SlackAgentRun,
	SlackRunContext,
	SlackRunContextResolver,
} from "../agent/agent-client";
import type { TokenCryptoConfig } from "../config";
import { decryptSlackToken } from "./token-crypto";

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
			botToken: decryptSlackToken(
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
			agentApiKeyId: installation.agentApiKeyId,
			organizationId: installation.organizationId,
			teamId: installation.teamId,
			websiteId: website.id,
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
			agentApiKeyId: slackIntegrations.agentApiKeyId,
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
