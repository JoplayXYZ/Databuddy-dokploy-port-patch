import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetBillingCustomerId = vi.fn(
	async (userId: string, organizationId?: string | null) =>
		organizationId ? `billing:${organizationId}:${userId}` : `billing:${userId}`
);
const mockGetOrganizationOwnerId = vi.fn(async (organizationId: string) =>
	organizationId === "org_missing" ? null : `owner:${organizationId}`
);

vi.mock("@databuddy/rpc", () => ({
	getAutumn: () => ({
		check: vi.fn(async () => ({ allowed: true })),
		track: vi.fn(async () => undefined),
	}),
	getBillingCustomerId: mockGetBillingCustomerId,
	getOrganizationOwnerId: mockGetOrganizationOwnerId,
}));

vi.mock("../../lib/databuddy", () => ({
	trackAgentEvent: vi.fn(() => {}),
}));

vi.mock("../../lib/tracing", () => ({
	captureError: vi.fn(() => {}),
	mergeWideEvent: vi.fn(() => {}),
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
