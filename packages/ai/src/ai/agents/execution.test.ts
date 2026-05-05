import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetBillingCustomerId = mock(
	async (userId: string, organizationId?: string | null) =>
		organizationId ? `billing:${organizationId}:${userId}` : `billing:${userId}`
);
const mockGetOrganizationOwnerId = mock(async (organizationId: string) =>
	organizationId === "org_missing" ? null : `owner:${organizationId}`
);

mock.module("@databuddy/rpc", () => ({
	getAutumn: () => ({
		check: mock(async () => ({ allowed: true })),
		track: mock(async () => undefined),
	}),
	getBillingCustomerId: mockGetBillingCustomerId,
	getOrganizationOwnerId: mockGetOrganizationOwnerId,
}));

mock.module("../../lib/databuddy", () => ({
	trackAgentEvent: mock(() => {}),
}));

mock.module("../../lib/tracing", () => ({
	captureError: mock(() => {}),
	mergeWideEvent: mock(() => {}),
}));

const { resolveAgentBillingCustomerId } = await import("./execution");

type AgentPrincipal = Parameters<typeof resolveAgentBillingCustomerId>[0];
type ApiKeyPrincipal = NonNullable<AgentPrincipal["apiKey"]>;

beforeEach(() => {
	mockGetBillingCustomerId.mockClear();
	mockGetOrganizationOwnerId.mockClear();
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
	});

	it("uses the standard billing owner resolver when a user is present", async () => {
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
