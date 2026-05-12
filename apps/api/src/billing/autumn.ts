import { auth } from "@databuddy/auth";
import { getBillingCustomerId, getMemberRole } from "@databuddy/rpc";
import { autumnHandler } from "autumn-js/fetch";
import { useLogger } from "evlog/elysia";
import { withAutumnApiPath } from "@/lib/autumn-mount";

const FORBIDDEN_BODY_KEYS = new Set([
	"customize",
	"invoiceMode",
	"noBillingChanges",
	"enablePlanImmediately",
	"processorSubscriptionId",
	"processorSubId",
	"checkoutSessionParams",
	"customLineItems",
	"successUrl",
	"returnUrl",
	"cancelUrl",
	"trialEnd",
	"billingCycleAnchor",
	"prorationBehavior",
]);

function sanitize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sanitize);
	}
	if (!value || typeof value !== "object") {
		return value;
	}
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value)) {
		if (FORBIDDEN_BODY_KEYS.has(key)) {
			continue;
		}
		out[key] = sanitize(val);
	}
	return out;
}

async function stripPrivilegedBody(request: Request): Promise<Request> {
	if (request.method === "GET" || request.method === "HEAD") {
		return request;
	}
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return request;
	}

	const text = await request.text();
	if (!text) {
		return new Request(request.url, request);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body: text,
		});
	}

	return new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body: JSON.stringify(sanitize(parsed)),
	});
}

export async function handleAutumnRequest(request: Request) {
	const sanitized = await stripPrivilegedBody(request);
	return autumnHandler({
		identify: identifyAutumnCustomer,
	})(withAutumnApiPath(sanitized));
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

		if (activeOrgId) {
			const role = await getMemberRole(session.user.id, activeOrgId);
			if (role !== "owner" && role !== "admin") {
				return null;
			}
		}

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
