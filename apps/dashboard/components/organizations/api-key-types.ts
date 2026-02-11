import type { API_SCOPES, ApiScope } from "@databuddy/api-keys/scopes";

export const SCOPE_OPTIONS: { value: ApiScope; label: string }[] = [
	{ value: "read:data", label: "Read Data" },
	{ value: "write:llm", label: "LLM Tracking" },
	{ value: "track:events", label: "Event Tracking" },
	{ value: "read:links", label: "Read Links" },
	{ value: "write:links", label: "Write Links" },
] as const satisfies { value: (typeof API_SCOPES)[number]; label: string }[];

export type ApiResourceType =
	| "global"
	| "website"
	| "ab_experiment"
	| "feature_flag"
	| "analytics_data"
	| "error_data"
	| "web_vitals"
	| "custom_events"
	| "export_data";

export interface ApiKeyAccessEntry {
	resourceType: ApiResourceType;
	resourceId?: string | null;
	scopes: ApiScope[];
}

export interface ApiKeyListItem {
	id: string;
	name: string;
	prefix: string;
	start: string;
	type: "user" | "sdk" | "automation";
	enabled: boolean;
	revokedAt?: Date | null;
	expiresAt?: string | null;
	scopes: ApiScope[];
	rateLimitEnabled?: boolean;
	rateLimitTimeWindow?: number | null;
	rateLimitMax?: number | null;
	createdAt: Date;
	updatedAt: Date;
	metadata?: Record<string, unknown>;
}

export interface ApiKeyDetail extends ApiKeyListItem {
	access: Array<{ id: string } & ApiKeyAccessEntry>;
}

export interface CreateApiKeyInput {
	name: string;
	organizationId?: string;
	type?: "user" | "sdk" | "automation";
	globalScopes?: ApiScope[];
	access?: ApiKeyAccessEntry[];
	rateLimitEnabled?: boolean;
	rateLimitTimeWindow?: number;
	rateLimitMax?: number;
	expiresAt?: string;
	metadata?: Record<string, unknown>;
}
