import { and, desc, eq } from "@databuddy/db";
import {
	slackChannelBindings,
	slackIntegrations,
	websites,
} from "@databuddy/db/schema";
import { z } from "zod";
import { rpcError } from "../errors";
import { protectedProcedure, trackedProcedure } from "../orpc";
import { withWorkspace } from "../procedures/with-workspace";

const slackChannelBindingOutputSchema = z.object({
	id: z.string(),
	slackChannelId: z.string(),
	websiteId: z.string(),
	websiteName: z.string().nullable(),
	websiteDomain: z.string().nullable(),
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
	defaultWebsiteId: z.string().nullable(),
	defaultWebsiteName: z.string().nullable(),
	defaultWebsiteDomain: z.string().nullable(),
	status: z.enum(["active", "disabled"]),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	channelBindings: z.array(slackChannelBindingOutputSchema),
});

const listOutputSchema = z.object({
	slack: z.array(slackIntegrationOutputSchema),
});

const updateSlackDefaultWebsiteInputSchema = z.object({
	organizationId: z.string().min(1),
	integrationId: z.string().min(1),
	defaultWebsiteId: z.string().min(1).nullable(),
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

			const slackRows = await context.db
				.select({
					id: slackIntegrations.id,
					teamId: slackIntegrations.teamId,
					teamName: slackIntegrations.teamName,
					enterpriseId: slackIntegrations.enterpriseId,
					appId: slackIntegrations.appId,
					botId: slackIntegrations.botId,
					botUserId: slackIntegrations.botUserId,
					defaultWebsiteId: slackIntegrations.defaultWebsiteId,
					defaultWebsiteName: websites.name,
					defaultWebsiteDomain: websites.domain,
					status: slackIntegrations.status,
					createdAt: slackIntegrations.createdAt,
					updatedAt: slackIntegrations.updatedAt,
				})
				.from(slackIntegrations)
				.leftJoin(websites, eq(slackIntegrations.defaultWebsiteId, websites.id))
				.where(eq(slackIntegrations.organizationId, input.organizationId))
				.orderBy(desc(slackIntegrations.updatedAt));

			const slack = await Promise.all(
				slackRows.map(async (integration) => {
					const channelBindings = await context.db
						.select({
							id: slackChannelBindings.id,
							slackChannelId: slackChannelBindings.slackChannelId,
							websiteId: slackChannelBindings.websiteId,
							websiteName: websites.name,
							websiteDomain: websites.domain,
							createdAt: slackChannelBindings.createdAt,
							updatedAt: slackChannelBindings.updatedAt,
						})
						.from(slackChannelBindings)
						.leftJoin(websites, eq(slackChannelBindings.websiteId, websites.id))
						.where(eq(slackChannelBindings.integrationId, integration.id))
						.orderBy(desc(slackChannelBindings.updatedAt));

					return {
						...integration,
						channelBindings,
					};
				})
			);

			return { slack };
		}),

	updateSlackDefaultWebsite: trackedProcedure
		.route({
			description:
				"Updates the default Databuddy website used by a Slack workspace integration.",
			method: "POST",
			path: "/integrations/updateSlackDefaultWebsite",
			summary: "Update Slack default website",
			tags: ["Integrations"],
		})
		.input(updateSlackDefaultWebsiteInputSchema)
		.output(successOutputSchema)
		.handler(async ({ context, input }) => {
			await withWorkspace(context, {
				organizationId: input.organizationId,
				resource: "organization",
				permissions: ["update"],
			});

			if (input.defaultWebsiteId) {
				const website = await context.db.query.websites.findFirst({
					where: {
						id: input.defaultWebsiteId,
						organizationId: input.organizationId,
					},
					columns: { id: true },
				});
				if (!website) {
					throw rpcError.badRequest(
						"Default website must belong to this organization"
					);
				}
			}

			const [updated] = await context.db
				.update(slackIntegrations)
				.set({
					defaultWebsiteId: input.defaultWebsiteId,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(slackIntegrations.id, input.integrationId),
						eq(slackIntegrations.organizationId, input.organizationId)
					)
				)
				.returning({ id: slackIntegrations.id });

			if (!updated) {
				throw rpcError.notFound("Slack integration", input.integrationId);
			}

			return { success: true };
		}),
};
