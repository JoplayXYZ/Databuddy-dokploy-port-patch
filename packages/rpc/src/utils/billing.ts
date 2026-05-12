import { db } from "@databuddy/db";
import { cacheNamespaces, cacheTags, cacheable } from "@databuddy/redis";
import { getAutumn } from "../lib/autumn-client";
import { logger, record } from "../lib/logger";

export interface BillingOwner {
	canUserUpgrade: boolean;
	customerId: string;
	isOrganization: boolean;
	planId: string;
}

const _getOrganizationOwnerId = async (
	organizationId: string
): Promise<string | null> => {
	if (!organizationId) {
		return null;
	}
	try {
		const orgMember = await db.query.member.findFirst({
			where: { organizationId, role: "owner" },
			columns: { userId: true },
		});
		return orgMember?.userId ?? null;
	} catch (error) {
		logger.error({ error }, "Error resolving organization owner");
		return null;
	}
};

export const getOrganizationOwnerId = cacheable(_getOrganizationOwnerId, {
	expireInSec: 300,
	prefix: cacheNamespaces.organizationOwner,
	staleWhileRevalidate: true,
	staleTime: 60,
});

export async function getBillingCustomerId(
	userId: string,
	organizationId?: string | null
): Promise<string> {
	if (!organizationId) {
		return userId;
	}
	const orgOwnerId = await getOrganizationOwnerId(organizationId);
	return orgOwnerId ?? userId;
}

export const getMemberRole = cacheable(
	async (userId: string, organizationId: string): Promise<string | null> => {
		const row = await db.query.member.findFirst({
			where: { organizationId, userId },
			columns: { role: true },
		});
		return row?.role ?? null;
	},
	{
		expireInSec: 300,
		prefix: cacheNamespaces.memberRole,
		staleWhileRevalidate: true,
		staleTime: 60,
	}
);

export const getBillingOwner = cacheable(
	async (
		userId: string,
		organizationId: string | null | undefined
	): Promise<BillingOwner> => {
		let customerId = userId;
		let isOrganization = false;
		let canUserUpgrade = true;

		if (organizationId) {
			const [ownerId, role] = await Promise.all([
				getOrganizationOwnerId(organizationId),
				getMemberRole(userId, organizationId),
			]);

			if (ownerId) {
				customerId = ownerId;
				isOrganization = true;
				canUserUpgrade =
					ownerId === userId || role === "admin" || role === "owner";
			}
		}

		let planId = "free";
		try {
			const customer = await record("autumn.getOrCreate", () =>
				getAutumn().customers.getOrCreate({ customerId })
			);

			const subs = customer.subscriptions;
			const activeSub =
				subs.find((s) => s.status === "active" && s.addOn === false) ??
				subs.find((s) => s.status === "active");
			if (activeSub?.planId) {
				planId = String(activeSub.planId).toLowerCase();
			}
		} catch {
			planId = "free";
		}

		return { customerId, isOrganization, canUserUpgrade, planId };
	},
	{
		expireInSec: 300,
		prefix: cacheNamespaces.billingOwner,
		staleWhileRevalidate: true,
		staleTime: 60,
		tags: (result, userId, organizationId) => {
			const tags = [
				cacheTags.billingOwner(userId),
				cacheTags.billingOwner(result.customerId),
			];
			if (organizationId) {
				tags.push(cacheTags.billingOwner(organizationId));
			}
			return tags;
		},
	}
);
