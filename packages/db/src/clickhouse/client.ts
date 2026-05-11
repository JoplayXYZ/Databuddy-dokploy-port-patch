import { createClient, type ResponseJSON } from "@clickhouse/client";
import type { NodeClickHouseClientConfigOptions } from "@clickhouse/client/dist/config";

import SqlString from "sqlstring";

let _record:
	| (<T>(name: string, fn: () => Promise<T> | T) => Promise<T>)
	| null = null;

export function setChRecordFn(
	fn: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>
) {
	_record = fn;
}

function traced<T>(name: string, fn: () => Promise<T>): Promise<T> {
	return _record ? _record(name, fn) : fn();
}

export interface ChQueryMetrics {
	elapsed_ms: number;
	memory_usage_bytes?: number;
	query_id: string;
	read_bytes: number;
	read_rows: number;
	result_rows: number;
	served_by?: string;
	written_bytes: number;
	written_rows: number;
}

let _metricsFn: ((m: ChQueryMetrics) => void) | null = null;

export function setChMetricsFn(fn: (m: ChQueryMetrics) => void) {
	_metricsFn = fn;
}

function headerValue(
	headers: Record<string, string | string[] | undefined>,
	name: string
): string | undefined {
	const v = headers[name];
	return Array.isArray(v) ? v[0] : v;
}

function reportChMetrics(
	headers: Record<string, string | string[] | undefined>,
	queryId: string
): void {
	if (!_metricsFn) {
		return;
	}
	const summary = headerValue(headers, "x-clickhouse-summary");
	if (!summary) {
		return;
	}
	try {
		const s = JSON.parse(summary) as Record<string, string>;
		const num = (k: string) => Number(s[k] ?? 0) || 0;
		_metricsFn({
			read_rows: num("read_rows"),
			read_bytes: num("read_bytes"),
			result_rows: num("result_rows"),
			written_rows: num("written_rows"),
			written_bytes: num("written_bytes"),
			elapsed_ms: num("elapsed_ns") / 1_000_000,
			memory_usage_bytes: s.memory_usage ? num("memory_usage") : undefined,
			served_by: headerValue(headers, "x-clickhouse-server-display-name"),
			query_id: queryId,
		});
	} catch {
		// instrumentation must never break the query path
	}
}
/**
 * ClickHouse table names used throughout the application
 */
export const TABLE_NAMES = {
	events: "analytics.events",
	outgoing_links: "analytics.outgoing_links",
	blocked_traffic: "analytics.blocked_traffic",
	error_spans: "analytics.error_spans",
	web_vitals_spans: "analytics.web_vitals_spans",
	custom_events: "analytics.custom_events",
	ai_traffic_spans: "analytics.ai_traffic_spans",
	link_visits: "analytics.link_visits",
};

const logger = console;

export const CLICKHOUSE_OPTIONS: NodeClickHouseClientConfigOptions = {
	max_open_connections: 30,
	request_timeout: 30_000,
	keep_alive: {
		enabled: true,
		idle_socket_ttl: 8000,
	},
	compression: {
		request: true,
		response: true,
	},
};

export const clickHouseOG = createClient({
	url: process.env.CLICKHOUSE_URL,
	...CLICKHOUSE_OPTIONS,
});

async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 3,
	baseDelay = 500
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const res = await operation();
			if (attempt > 0) {
				logger.info("Retry operation succeeded", { attempt });
			}
			return res;
		} catch (error: any) {
			lastError = error;

			if (
				error.message.includes("Connect") ||
				error.message.includes("socket hang up") ||
				error.message.includes("Timeout error")
			) {
				const delay = baseDelay * 2 ** attempt;
				logger.warn(
					`Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`,
					{
						error: error.message,
					}
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			throw error; // Non-retriable error
		}
	}

	throw lastError;
}

export const clickHouse = new Proxy(clickHouseOG, {
	get(target, property, receiver) {
		const value = Reflect.get(target, property, receiver);

		if (property === "insert") {
			return (...args: any[]) => withRetry(() => value.apply(target, args));
		}

		return value;
	},
});

export interface ChQueryOptions {
	clickhouse_settings?: Record<string, string | number>;
	readonly?: boolean;
}

export async function chQueryWithMeta<T extends Record<string, any>>(
	query: string,
	params?: Record<string, unknown>,
	options?: ChQueryOptions
): Promise<ResponseJSON<T>> {
	const json = await traced("ch.query", async () => {
		const settings: Record<string, string | number> = {
			...(options?.readonly && { readonly: "1" }),
			...options?.clickhouse_settings,
		};
		const res = await clickHouse.query({
			query,
			query_params: params,
			...(Object.keys(settings).length > 0 && {
				clickhouse_settings: settings,
			}),
		});
		const data = await res.json<T>();
		reportChMetrics(res.response_headers, res.query_id);
		return data;
	});
	const keys = Object.keys(json.data[0] || {});

	return {
		...json,
		data: json.data.map((item) =>
			keys.reduce(
				(acc, key) => {
					const meta = json.meta?.find((m) => m.name === key);
					acc[key] =
						item[key] && meta?.type.includes("Int")
							? Number.parseFloat(item[key] as string)
							: item[key];
					return acc;
				},
				{} as Record<string, any>
			)
		),
	} as ResponseJSON<T>;
}

export function chQuery<T extends Record<string, any>>(
	query: string,
	params?: Record<string, unknown>,
	options?: ChQueryOptions
): Promise<T[]> {
	return chQueryWithMeta<T>(query, params, options).then((res) => res.data);
}

export async function chCommand(
	query: string,
	params?: Record<string, unknown>
): Promise<void> {
	await traced("ch.command", async () => {
		const res = await clickHouse.command({
			query,
			query_params: params,
			clickhouse_settings: { wait_end_of_query: 1 },
		});
		reportChMetrics(res.response_headers, res.query_id);
	});
}

const Z_REGEX = /Z+$/;
const DATE_REGEX = /\d{4}-\d{2}-\d{2}/;

export function formatClickhouseDate(
	date: Date | string,
	skipTime = false
): string {
	if (skipTime) {
		return new Date(date).toISOString().split("T")[0] ?? "";
	}
	return new Date(date).toISOString().replace("T", " ").replace(Z_REGEX, "");
}

export function toDate(str: string, interval?: string) {
	if (!interval || interval === "minute" || interval === "hour") {
		if (DATE_REGEX.test(str)) {
			return SqlString.escape(str);
		}

		return str;
	}

	if (DATE_REGEX.test(str)) {
		return `toDate(${SqlString.escape(str.split(" ")[0])})`;
	}

	return `toDate(${SqlString.escape(str)})`;
}

export function convertClickhouseDateToJs(date: string) {
	return new Date(`${date.replace(" ", "T")}Z`);
}
