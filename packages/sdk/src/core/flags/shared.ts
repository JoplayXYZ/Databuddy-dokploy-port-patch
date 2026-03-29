import type { FlagResult, FlagsConfig, UserContext } from "./types";

export const DEFAULT_RESULT: FlagResult = {
	enabled: false,
	value: false,
	payload: null,
	reason: "DEFAULT",
};

export function getCacheKey(key: string, user?: UserContext): string {
	if (!(user?.userId || user?.email)) {
		return key;
	}
	return `${key}:${user.userId ?? ""}:${user.email ?? ""}`;
}

export function buildQueryParams(
	config: FlagsConfig,
	user?: UserContext
): URLSearchParams {
	const params = new URLSearchParams();
	params.set("clientId", config.clientId);

	const u = user ?? config.user;
	if (u?.userId) {
		params.set("userId", u.userId);
	}
	if (u?.email) {
		params.set("email", u.email);
	}
	if (u?.organizationId) {
		params.set("organizationId", u.organizationId);
	}
	if (u?.teamId) {
		params.set("teamId", u.teamId);
	}
	if (u?.properties) {
		params.set("properties", JSON.stringify(u.properties));
	}
	if (config.environment) {
		params.set("environment", config.environment);
	}

	return params;
}

export async function fetchFlags(
	apiUrl: string,
	keys: string[],
	params: URLSearchParams
): Promise<Record<string, FlagResult>> {
	const batchParams = new URLSearchParams(params);
	batchParams.set("keys", keys.join(","));

	const url = `${apiUrl}/public/v1/flags/bulk?${batchParams}`;

	const response = await fetch(url);

	if (!response.ok) {
		const result: Record<string, FlagResult> = {};
		for (const key of keys) {
			result[key] = { ...DEFAULT_RESULT, reason: "ERROR" };
		}
		return result;
	}

	const data = (await response.json()) as {
		flags?: Record<string, FlagResult>;
	};
	return data.flags ?? {};
}

export async function fetchAllFlags(
	apiUrl: string,
	params: URLSearchParams
): Promise<Record<string, FlagResult>> {
	const url = `${apiUrl}/public/v1/flags/bulk?${params}`;

	const response = await fetch(url);

	if (!response.ok) {
		return {};
	}

	const data = (await response.json()) as {
		flags?: Record<string, FlagResult>;
	};
	return data.flags ?? {};
}

export class RequestBatcher {
	private readonly pending = new Map<
		string,
		{ resolve: (r: FlagResult) => void; reject: (e: Error) => void }[]
	>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly batchDelayMs: number;
	private readonly apiUrl: string;
	private readonly params: URLSearchParams;

	constructor(apiUrl: string, params: URLSearchParams, batchDelayMs = 10) {
		this.apiUrl = apiUrl;
		this.params = params;
		this.batchDelayMs = batchDelayMs;
	}

	request(key: string): Promise<FlagResult> {
		return new Promise((resolve, reject) => {
			const existing = this.pending.get(key);
			if (existing) {
				existing.push({ resolve, reject });
			} else {
				this.pending.set(key, [{ resolve, reject }]);
			}

			if (!this.timer) {
				this.timer = setTimeout(() => this.flush(), this.batchDelayMs);
			}
		});
	}

	private async flush(): Promise<void> {
		this.timer = null;

		const keys = [...this.pending.keys()];
		const callbacks = new Map(this.pending);
		this.pending.clear();

		if (keys.length === 0) {
			return;
		}

		try {
			const results = await fetchFlags(this.apiUrl, keys, this.params);

			for (const [key, cbs] of callbacks) {
				const result = results[key] ?? {
					...DEFAULT_RESULT,
					reason: "NOT_FOUND",
				};
				for (const cb of cbs) {
					cb.resolve(result);
				}
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error("Fetch failed");
			for (const cbs of callbacks.values()) {
				for (const cb of cbs) {
					cb.reject(error);
				}
			}
		}
	}

	destroy(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pending.clear();
	}
}
