import { auth } from "@databuddy/auth";
import { getBillingCustomerId } from "@databuddy/rpc";
import { autumnHandler } from "autumn-js/fetch";
import { useLogger } from "evlog/elysia";
import { withAutumnApiPath } from "@/lib/autumn-mount";

export function handleAutumnRequest(request: Request) {
	return autumnHandler({
		identify: identifyAutumnCustomer,
	})(withAutumnApiPath(request));
}

async function identifyAutumnCustomer(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return null;
		}

		const activeOrgId = (
			session.session as { activeOrganizationId?: string | null }
		)?.activeOrganizationId;
		const customerId = await getBillingCustomerId(session.user.id, activeOrgId);

		return {
			customerId,
			customerData: {
				name: session.user.name,
				email: session.user.email,
			},
		};
	} catch (error) {
		useLogger().error(
			error instanceof Error ? error : new Error(String(error)),
			{
				autumn: "identify",
			}
		);
		return null;
	}
}
