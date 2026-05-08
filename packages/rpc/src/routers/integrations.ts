import { and, desc, eq } from "@databuddy/db";
import {
	slackChannelBindings,
	slackIntegrations,
} from "@databuddy/db/schema";
import { invalidateCacheableKey } from "@databuddy/redis";
import { z } from "zod";
import { rpcError } from "../errors";
import { protectedProcedure, trackedProcedure } from "../orpc";
import { withWorkspace } from "../procedures/with-workspace";

const slackChannelBindingOutputSchema = z.object({
	id: z.string(),
	slackChannelId: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

const slackIntegrationOutputSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	teamName: z.string().nullable(),
	enterpriseId: z.string().nullable(),
	appId: z.string().nullable(),
	botId: z.string().nullable(),
	botUserId: z.string().nullable(),
	status: z.enum(["active", "disabled"]),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	channelBindings: z.array(slackChannelBindingOutputSchema),
});

const listOutputSchema = z.object({
	slack: z.array(slackIntegrationOutputSchema),
});

const uninstallSlackInputSchema = z.object({
	organizationId: z.string().min(1),
	integrationId: z.string().min(1),
});

const successOutputSchema = z.object({ success: z.literal(true) });

export type SlackIntegrationOutput = z.infer<
	typeof slackIntegrationOutputSchema
>;

export const integrationsRouter = {
	list: protectedProcedure
		.route({
			description: "Returns organization-scoped integration connections.",
			method: "POST",
			path: "/integrations/list",
			summary: "List integrations",
			tags: ["Integrations"],
		})
		.input(z.object({ organizationId: z.string().min(1) }))
		.output(listOutputSchema)
		.handler(async ({ context, input }) => {
			await withWorkspace(context, {
				organizationId: input.organizationId,
				resource: "organization",
				permissions: ["read"],
			});

			let slackRows: SlackIntegrationRow[];
			try {
				slackRows = await context.db
					.select({
						id: slackIntegrations.id,
						teamId: slackIntegrations.teamId,
						teamName: slackIntegrations.teamName,
						enterpriseId: slackIntegrations.enterpriseId,
						appId: slackIntegrations.appId,
						botId: slackIntegrations.botId,
						botUserId: slackIntegrations.botUserId,
						status: slackIntegrations.status,
						createdAt: slackIntegrations.createdAt,
						updatedAt: slackIntegrations.updatedAt,
					})
					.from(slackIntegrations)
					.where(eq(slackIntegrations.organizationId, input.organizationId))
					.orderBy(desc(slackIntegrations.updatedAt));
			} catch (error) {
				if (isMissingSlackSchemaError(error)) {
					return { slack: [] };
				}
				throw error;
			}

			const slack = await Promise.all(
				slackRows.map(async (integration) => {
					let channelBindings: SlackChannelBindingRow[];
					try {
						channelBindings = await context.db
							.select({
								id: slackChannelBindings.id,
								slackChannelId: slackChannelBindings.slackChannelId,
								createdAt: slackChannelBindings.createdAt,
								updatedAt: slackChannelBindings.updatedAt,
							})
							.from(slackChannelBindings)
							.where(eq(slackChannelBindings.integrationId, integration.id))
							.orderBy(desc(slackChannelBindings.updatedAt));
					} catch (error) {
						if (isMissingSlackSchemaError(error)) {
							channelBindings = [];
						} else {
							throw error;
						}
					}

					return {
						...integration,
						channelBindings,
					};
				})
			);

			return { slack };
		}),

	uninstallSlack: trackedProcedure
		.route({
			description: "Disconnects a Slack workspace integration.",
			method: "POST",
			path: "/integrations/uninstallSlack",
			summary: "Uninstall Slack",
			tags: ["Integrations"],
		})
		.input(uninstallSlackInputSchema)
		.output(successOutputSchema)
		.handler(async ({ context, input }) => {
			await withWorkspace(context, {
				organizationId: input.organizationId,
				resource: "organization",
				permissions: ["update"],
			});

			let revokedTeamId: string | undefined;

			try {
				const [integration] = await context.db
					.select({
						id: slackIntegrations.id,
						teamId: slackIntegrations.teamId,
					})
					.from(slackIntegrations)
					.where(
						and(
							eq(slackIntegrations.id, input.integrationId),
							eq(slackIntegrations.organizationId, input.organizationId)
						)
					)
					.limit(1);

				if (!integration) {
					throw rpcError.notFound("Slack integration", input.integrationId);
				}

				revokedTeamId = integration.teamId;

				await context.db
					.delete(slackIntegrations)
					.where(eq(slackIntegrations.id, integration.id));
			} catch (error) {
				if (isMissingSlackSchemaError(error)) {
					throw rpcError.notFound("Slack integration", input.integrationId);
				}
				throw error;
			}

			if (revokedTeamId) {
				await invalidateCacheableKey(
					"slack-integration-by-team",
					revokedTeamId
				);
			}

			return { success: true };
		}),
};

type SlackIntegrationRow = Omit<SlackIntegrationOutput, "channelBindings">;
type SlackChannelBindingRow = z.infer<typeof slackChannelBindingOutputSchema>;

function isMissingSlackSchemaError(error: unknown): boolean {
	if (error instanceof Error && isMissingSlackSchemaError(error.cause)) {
		return true;
	}

	if (!(typeof error === "object" && error !== null)) {
		return false;
	}

	const pgError = error as {
		code?: unknown;
		message?: unknown;
		relation?: unknown;
	};
	if (pgError.code !== "42P01") {
		return false;
	}

	const relation = typeof pgError.relation === "string" ? pgError.relation : "";
	const message = typeof pgError.message === "string" ? pgError.message : "";
	return (
		relation.startsWith("slack_") ||
		message.includes("slack_integrations") ||
		message.includes("slack_channel_bindings")
	);
}
