import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockAutumnCheck = mock(async () => ({
	allowed: true,
	balance: {
		granted: 100,
		remaining: 42,
		unlimited: false,
		usage: 58,
	},
}));
const mockGetBillingCustomerId = mock(
	async (userId: string, organizationId?: string | null) =>
		organizationId ? `billing:${organizationId}:${userId}` : `billing:${userId}`
);
const mockGetOrganizationOwnerId = mock(async (organizationId: string) =>
	organizationId === "org_missing" ? null : `owner:${organizationId}`
);
const mockMergeWideEvent = mock((_: Record<string, unknown>) => {});

mock.module("@databuddy/rpc/autumn", () => ({
	getAutumn: () => ({
		check: mockAutumnCheck,
		track: mock(async () => undefined),
	}),
}));

mock.module("@databuddy/rpc/billing", () => ({
	getBillingCustomerId: mockGetBillingCustomerId,
	getBillingOwner: mock(async (userId: string, organizationId?: string | null) => ({
		canUserUpgrade: true,
		customerId: await mockGetBillingCustomerId(userId, organizationId),
		isOrganization: Boolean(organizationId),
		planId: "free",
	})),
	getOrganizationOwnerId: mockGetOrganizationOwnerId,
}));

mock.module("../../lib/databuddy", () => ({
	trackAgentEvent: mock(() => {}),
}));

mock.module("../../lib/tracing", () => ({
	captureError: mock(() => {}),
	mergeWideEvent: mockMergeWideEvent,
}));

const { ensureAgentCreditsAvailable, resolveAgentBillingCustomerId } =
	await import("./execution");

type AgentPrincipal = Parameters<typeof resolveAgentBillingCustomerId>[0];
type ApiKeyPrincipal = NonNullable<AgentPrincipal["apiKey"]>;

beforeEach(() => {
	mockAutumnCheck.mockClear();
	mockGetBillingCustomerId.mockClear();
	mockGetOrganizationOwnerId.mockClear();
	mockMergeWideEvent.mockClear();
});

describe("resolveAgentBillingCustomerId", () => {
	it("bills the organization owner for org-scoped automation keys without a user", async () => {
		const customerId = await resolveAgentBillingCustomerId({
			apiKey: {
				organizationId: "org_slack",
				userId: null,
			} as ApiKeyPrincipal,
			organizationId: null,
			userId: null,
		});

		expect(customerId).toBe("owner:org_slack");
		expect(mockGetOrganizationOwnerId).toHaveBeenCalledWith("org_slack");
		expect(mockGetBillingCustomerId).not.toHaveBeenCalled();
		expect(mockMergeWideEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				agent_billing_resolution: "api_key_org_owner",
				billing_customer_id: "owner:org_slack",
				organization_id: "org_slack",
			})
		);
	});

	it("bills the organization owner for org-scoped API keys even when the key has a user", async () => {
		const customerId = await resolveAgentBillingCustomerId({
			apiKey: {
				organizationId: "org_slack",
				userId: "installer_123",
			} as ApiKeyPrincipal,
			organizationId: null,
			userId: "installer_123",
		});

		expect(customerId).toBe("owner:org_slack");
		expect(mockGetOrganizationOwnerId).toHaveBeenCalledWith("org_slack");
		expect(mockGetBillingCustomerId).not.toHaveBeenCalled();
	});

	it("uses the standard billing owner resolver for session users", async () => {
		const customerId = await resolveAgentBillingCustomerId({
			apiKey: null,
			organizationId: "org_slack",
			userId: "user_123",
		});

		expect(customerId).toBe("billing:org_slack:user_123");
		expect(mockGetBillingCustomerId).toHaveBeenCalledWith(
			"user_123",
			"org_slack"
		);
		expect(mockGetOrganizationOwnerId).not.toHaveBeenCalled();
	});

	it("returns null when neither a user nor organization can be resolved", async () => {
		const customerId = await resolveAgentBillingCustomerId({
			apiKey: null,
			organizationId: null,
			userId: null,
		});

		expect(customerId).toBeNull();
	});
});

describe("ensureAgentCreditsAvailable", () => {
	it("logs the checked Autumn customer and balance", async () => {
		const allowed = await ensureAgentCreditsAvailable("owner:org_slack");

		expect(allowed).toBe(true);
		expect(mockAutumnCheck).toHaveBeenCalledWith({
			customerId: "owner:org_slack",
			featureId: "agent_credits",
		});
		expect(mockMergeWideEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				agent_credits_allowed: true,
				agent_credits_feature_id: "agent_credits",
				agent_credits_granted: 100,
				agent_credits_remaining: 42,
				agent_credits_unlimited: false,
				agent_credits_usage: 58,
				billing_customer_id: "owner:org_slack",
			})
		);
	});

	it("skips Autumn when billing is not configured", async () => {
		const allowed = await ensureAgentCreditsAvailable(null);

		expect(allowed).toBe(true);
		expect(mockAutumnCheck).not.toHaveBeenCalled();
		expect(mockMergeWideEvent).toHaveBeenCalledWith({
			agent_credits_allowed: true,
			agent_credits_check_skipped: true,
		});
	});
});
