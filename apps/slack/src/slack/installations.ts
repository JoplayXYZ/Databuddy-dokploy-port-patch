import { and, db, eq } from "@databuddy/db";
import { slackChannelBindings, slackIntegrations } from "@databuddy/db/schema";
import { decrypt } from "@databuddy/encryption";
import type { Authorize } from "@slack/bolt";
import { randomUUIDv7 } from "bun";
import type {
	SlackAgentRun,
	SlackRunContext,
	SlackRunContextResolver,
} from "../agent/agent-client";
import type { TokenCryptoConfig } from "../config";

export interface SlackChannelBindingCommand {
	channelId: string;
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
		return installation ? this.toRunContext(installation) : null;
	}

	async bindChannel({
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

		const now = new Date();
		await db
			.insert(slackChannelBindings)
			.values({
				createdAt: now,
				id: randomUUIDv7(),
				integrationId: installation.id,
				slackChannelId: channelId,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				set: { updatedAt: now },
				target: [
					slackChannelBindings.integrationId,
					slackChannelBindings.slackChannelId,
				],
			});

		return {
			message:
				"This channel is now connected to the Databuddy organization for this Slack workspace.",
			ok: true,
		};
	}

	private toRunContext(installation: ActiveSlackIntegration): SlackRunContext {
		return {
			agentApiKeySecret: decrypt(
				installation.agentApiKeyCiphertext,
				this.#crypto.encryptionKey
			),
			organizationId: installation.organizationId,
			teamId: installation.teamId,
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

type ActiveSlackIntegration = NonNullable<
	Awaited<ReturnType<typeof findActiveIntegration>>
>;
