import { keys } from "@databuddy/api-keys/resolve";
import { auth } from "@databuddy/auth";
import { and, db, eq } from "@databuddy/db";
import { apikey, member, slackIntegrations } from "@databuddy/db/schema";
import { encrypt } from "@databuddy/encryption";
import { invalidateCacheableKey } from "@databuddy/redis/cache-invalidation";
import { randomUUIDv7 } from "bun";
import { Elysia, t } from "elysia";
import { useLogger } from "evlog/elysia";
import {
	createSlackOAuthState,
	type SlackOAuthState,
	verifySlackOAuthState,
} from "./slack-state";

const SLACK_OAUTH_SCOPES = [
	"assistant:write",
	"app_mentions:read",
	"chat:write",
	"commands",
	"im:history",
] as const;

const SLACK_STATE_TTL_MS = 10 * 60 * 1000;
const SLACK_API_KEY_SCOPES = ["read:data"] as const;
const SLACK_API_KEY_RESOURCES = { global: [...SLACK_API_KEY_SCOPES] };

interface SlackOAuthConfig {
	authSecret: string;
	clientId: string;
	clientSecret: string;
	encryptionKey: string;
	redirectUri: string;
}

interface SlackAccessResponse {
	accessToken: string;
	appId: string | null;
	botUserId: string | null;
	enterpriseId: string | null;
	teamId: string;
	teamName: string | null;
}

interface SlackBotIdentity {
	botId: string | null;
	botUserId: string | null;
	teamId: string | null;
	teamName: string | null;
}

class SlackInstallError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SlackInstallError";
	}
}

function getString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

function getDashboardUrl(): string {
	return process.env.BETTER_AUTH_URL || "http://localhost:3000";
}

function integrationsRedirect(
	status: "connected" | "error",
	message?: string
): Response {
	const url = new URL(
		"/organizations/settings/integrations",
		getDashboardUrl()
	);
	url.searchParams.set("slack", status);
	if (message) {
		url.searchParams.set("message", message);
	}
	return Response.redirect(url.toString(), 302);
}

function requireConfig(request: Request): SlackOAuthConfig {
	const missing: string[] = [];
	const authSecret = process.env.BETTER_AUTH_SECRET;
	const clientId = process.env.SLACK_CLIENT_ID;
	const clientSecret = process.env.SLACK_CLIENT_SECRET;
	const encryptionKey = process.env.DATABUDDY_ENCRYPTION_KEY;

	if (!authSecret) {
		missing.push("BETTER_AUTH_SECRET");
	}
	if (!clientId) {
		missing.push("SLACK_CLIENT_ID");
	}
	if (!clientSecret) {
		missing.push("SLACK_CLIENT_SECRET");
	}
	if (!encryptionKey) {
		missing.push("DATABUDDY_ENCRYPTION_KEY");
	}
	if (
		missing.length > 0 ||
		!(authSecret && clientId && clientSecret && encryptionKey)
	) {
		throw new SlackInstallError(`Slack OAuth is missing ${missing.join(", ")}`);
	}

	return {
		authSecret,
		clientId,
		clientSecret,
		encryptionKey,
		redirectUri:
			process.env.SLACK_REDIRECT_URI ||
			new URL("/v1/integrations/slack/callback", request.url).toString(),
	};
}

async function requireOrgInstaller(
	request: Request,
	organizationId: string
): Promise<string> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		throw new SlackInstallError("Sign in before connecting Slack");
	}

	const [membership] = await db
		.select({ role: member.role })
		.from(member)
		.where(
			and(
				eq(member.organizationId, organizationId),
				eq(member.userId, session.user.id)
			)
		)
		.limit(1);

	if (!(membership?.role === "owner" || membership?.role === "admin")) {
		throw new SlackInstallError(
			"Only organization owners and admins can connect Slack"
		);
	}

	return session.user.id;
}

function buildSlackAuthorizeUrl(
	config: SlackOAuthConfig,
	state: string
): string {
	const url = new URL("https://slack.com/oauth/v2/authorize");
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("scope", SLACK_OAUTH_SCOPES.join(","));
	url.searchParams.set("state", state);
	return url.toString();
}

async function readSlackJson(
	response: Response
): Promise<Record<string, unknown>> {
	const body = getRecord(await response.json().catch(() => null));
	if (!body) {
		throw new SlackInstallError("Slack returned an invalid response");
	}
	return body;
}

async function exchangeSlackCode(
	config: SlackOAuthConfig,
	code: string
): Promise<SlackAccessResponse> {
	const response = await fetch("https://slack.com/api/oauth.v2.access", {
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			code,
			redirect_uri: config.redirectUri,
		}),
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		method: "POST",
	});
	const body = await readSlackJson(response);
	if (body.ok !== true) {
		throw new SlackInstallError(
			`Slack OAuth failed: ${getString(body.error) ?? "unknown_error"}`
		);
	}

	const team = getRecord(body.team);
	const enterprise = getRecord(body.enterprise);
	const accessToken = getString(body.access_token);
	const teamId = getString(team?.id);
	if (!(accessToken && teamId)) {
		throw new SlackInstallError(
			"Slack did not return a bot token and workspace id"
		);
	}

	return {
		accessToken,
		appId: getString(body.app_id),
		botUserId: getString(body.bot_user_id),
		enterpriseId: getString(enterprise?.id),
		teamId,
		teamName: getString(team?.name),
	};
}

async function readSlackBotIdentity(token: string): Promise<SlackBotIdentity> {
	const response = await fetch("https://slack.com/api/auth.test", {
		headers: { Authorization: `Bearer ${token}` },
	});
	const body = await readSlackJson(response);
	if (body.ok !== true) {
		throw new SlackInstallError(
			`Slack token verification failed: ${
				getString(body.error) ?? "unknown_error"
			}`
		);
	}

	return {
		botId: getString(body.bot_id),
		botUserId: getString(body.user_id),
		teamId: getString(body.team_id),
		teamName: getString(body.team),
	};
}

async function saveSlackInstallation({
	access,
	config,
	identity,
	state,
}: {
	access: SlackAccessResponse;
	config: SlackOAuthConfig;
	identity: SlackBotIdentity;
	state: SlackOAuthState;
}): Promise<void> {
	const teamId = identity.teamId ?? access.teamId;
	const teamName = identity.teamName ?? access.teamName ?? teamId;
	const keyName = `Slack Agent - ${teamName}`.slice(0, 100);
	const { key: agentApiKeySecret, record } = await keys.create({
		expiresAt: null,
		name: keyName,
		ownerId: state.organizationId,
		resources: SLACK_API_KEY_RESOURCES,
		scopes: [...SLACK_API_KEY_SCOPES],
		tags: ["slack", "integration"],
	});
	const now = new Date();
	const revokedKeyHashes: string[] = [];

	await db.transaction(async (tx) => {
		const [existing] = await tx
			.select({
				agentApiKeyId: slackIntegrations.agentApiKeyId,
				id: slackIntegrations.id,
				organizationId: slackIntegrations.organizationId,
			})
			.from(slackIntegrations)
			.where(eq(slackIntegrations.teamId, teamId))
			.limit(1);

		if (existing && existing.organizationId !== state.organizationId) {
			throw new SlackInstallError(
				"This Slack workspace is already connected to another organization"
			);
		}

		await tx.insert(apikey).values({
			enabled: true,
			expiresAt: null,
			id: record.id,
			keyHash: record.keyHash,
			metadata: {
				description:
					"Used by the Slack integration to answer Databuddy analytics questions.",
				resources: SLACK_API_KEY_RESOURCES,
				tags: ["slack", "integration"],
			},
			name: keyName,
			organizationId: state.organizationId,
			prefix: agentApiKeySecret.split("_")[0] ?? "dbdy",
			rateLimitEnabled: true,
			scopes: [...SLACK_API_KEY_SCOPES],
			start: agentApiKeySecret.slice(0, 8),
			type: "automation",
			userId: null,
		});

		const values = {
			agentApiKeyCiphertext: encrypt(agentApiKeySecret, config.encryptionKey),
			agentApiKeyId: record.id,
			appId: access.appId,
			botId: identity.botId,
			botTokenCiphertext: encrypt(access.accessToken, config.encryptionKey),
			botUserId: access.botUserId ?? identity.botUserId,
			enterpriseId: access.enterpriseId,
			installedByUserId: state.userId,
			organizationId: state.organizationId,
			status: "active" as const,
			teamId,
			teamName,
			updatedAt: now,
		};

		if (existing) {
			if (existing.agentApiKeyId !== record.id) {
				const [oldApiKey] = await tx
					.select({ keyHash: apikey.keyHash })
					.from(apikey)
					.where(eq(apikey.id, existing.agentApiKeyId))
					.limit(1);
				if (oldApiKey?.keyHash) {
					revokedKeyHashes.push(oldApiKey.keyHash);
				}
				await tx
					.update(apikey)
					.set({ enabled: false, revokedAt: now, updatedAt: now })
					.where(eq(apikey.id, existing.agentApiKeyId));
			}
			await tx
				.update(slackIntegrations)
				.set(values)
				.where(eq(slackIntegrations.id, existing.id));
			return;
		}

		await tx.insert(slackIntegrations).values({
			...values,
			createdAt: now,
			id: randomUUIDv7(),
		});
	});

	await Promise.all(
		revokedKeyHashes.map((hash) =>
			invalidateCacheableKey("api-key-by-hash", hash)
		)
	);
}

export const integrations = new Elysia({ prefix: "/v1/integrations" })
	.get(
		"/slack/install",
		async ({ query, request }) => {
			try {
				const config = requireConfig(request);
				const userId = await requireOrgInstaller(request, query.organizationId);
				const state = createSlackOAuthState(
					{
						expiresAt: Date.now() + SLACK_STATE_TTL_MS,
						nonce: randomUUIDv7(),
						organizationId: query.organizationId,
						userId,
					},
					config.authSecret
				);
				return Response.redirect(buildSlackAuthorizeUrl(config, state), 302);
			} catch (error) {
				useLogger().error(
					error instanceof Error ? error : new Error(String(error)),
					{ slack_oauth: "install" }
				);
				const message =
					error instanceof SlackInstallError
						? error.message
						: "Could not start Slack install";
				return integrationsRedirect("error", message);
			}
		},
		{
			query: t.Object({
				organizationId: t.String({ minLength: 1 }),
			}),
		}
	)
	.get(
		"/slack/callback",
		async ({ query, request }) => {
			if (query.error) {
				return integrationsRedirect("error", `Slack returned ${query.error}`);
			}
			try {
				if (!(query.code && query.state)) {
					throw new SlackInstallError("Slack did not return an OAuth code");
				}
				const config = requireConfig(request);
				const state = verifySlackOAuthState(query.state, config.authSecret);
				if (!state) {
					throw new SlackInstallError("Slack install link expired");
				}

				const access = await exchangeSlackCode(config, query.code);
				const identity = await readSlackBotIdentity(access.accessToken);
				await saveSlackInstallation({ access, config, identity, state });

				return integrationsRedirect("connected");
			} catch (error) {
				useLogger().error(
					error instanceof Error ? error : new Error(String(error)),
					{ slack_oauth: "callback" }
				);
				const message =
					error instanceof SlackInstallError
						? error.message
						: "Could not finish Slack install";
				return integrationsRedirect("error", message);
			}
		},
		{
			query: t.Object({
				code: t.Optional(t.String()),
				error: t.Optional(t.String()),
				state: t.Optional(t.String()),
			}),
		}
	);
