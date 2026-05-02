import { db } from "@databuddy/db";
import { featureAccessLog } from "@databuddy/db/schema";
import { randomUUIDv7 } from "bun";
import { logger } from "../lib/logger";
import { type Context, os } from "../orpc";

export async function isFlagGloballyEnabled(
	flagKey: string,
	organizationId: string
): Promise<boolean> {
	const flag = await db.query.flags.findFirst({
		where: { key: flagKey, organizationId },
		columns: { defaultValue: true, status: true },
	});

	if (!flag || flag.status !== "active") {
		return false;
	}

	return flag.defaultValue === true;
}

export async function hasRedeemedInvite(
	flagKey: string,
	userId: string
): Promise<boolean> {
	const invite = await db.query.featureInvite.findFirst({
		where: { flagKey, redeemedById: userId, status: "redeemed" },
		columns: { id: true },
	});

	return invite !== undefined;
}

export async function resolveFeatureAccess(
	context: Context,
	flagKey: string
): Promise<boolean> {
	const userId = context.user?.id;
	if (!userId) {
		return false;
	}

	const organizationId = context.organizationId;
	if (organizationId) {
		const globallyEnabled = await isFlagGloballyEnabled(
			flagKey,
			organizationId
		);
		if (globallyEnabled) {
			return true;
		}
	}

	return hasRedeemedInvite(flagKey, userId);
}

function logAccess(
	flagKey: string,
	actionType: "access_granted" | "access_denied",
	actorId: string | undefined,
	organizationId: string,
	metadata?: Record<string, unknown>
): void {
	db.insert(featureAccessLog)
		.values({
			id: randomUUIDv7(),
			flagKey,
			actionType,
			actorId,
			targetEmail: "",
			organizationId,
			metadata: metadata ?? null,
		})
		.catch((error) => {
			logger.error({ error, flagKey }, "Failed to log feature access");
		});
}

export const withFeatureAccess = (flagKey: string) =>
	os.middleware(async ({ context, next, errors }) => {
		const ctx = context as Context;
		const allowed = await resolveFeatureAccess(ctx, flagKey);

		if (allowed) {
			const userId = ctx.user?.id;
			const organizationId = ctx.organizationId;
			if (userId && organizationId) {
				logAccess(flagKey, "access_granted", userId, organizationId);
			}
			return next();
		}

		const userId = ctx.user?.id;
		const organizationId = ctx.organizationId ?? "";
		logAccess(flagKey, "access_denied", userId, organizationId);

		throw errors.FORBIDDEN({
			message: `This feature is invite-only. You need an invite to access "${flagKey}".`,
		});
	});
