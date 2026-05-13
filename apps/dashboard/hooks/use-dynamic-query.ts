import { publicConfig } from "@databuddy/env/public";
import type { DateRange } from "@/types/analytics";
import type {
	BatchQueryResponse,
	DynamicQueryRequest,
	DynamicQueryResponse,
} from "@/types/api";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { guessTimezone } from "@databuddy/ui";

const API_BASE_URL = publicConfig.urls.api;

export const dynamicQueryKeys = {
	all: () => ["dynamic-query"] as const,
	byWebsite: (websiteId: string) => ["dynamic-query", websiteId] as const,
};

export const batchDynamicQueryKeys = {
	all: () => ["batch-dynamic-query"] as const,
	byWebsite: (websiteId: string) => ["batch-dynamic-query", websiteId] as const,
};

interface BuildParamsOptions {
	additionalParams?: Record<string, string | number>;
	dateRange?: DateRange;
	linkId?: string;
	organizationId?: string;
	scheduleId?: string;
	websiteId?: string;
}

function buildParams({
	websiteId,
	scheduleId,
	linkId,
	organizationId,
	dateRange,
	additionalParams,
}: BuildParamsOptions): URLSearchParams {
	const params = new URLSearchParams(
		additionalParams as Record<string, string>
	);

	if (linkId) {
		params.set("link_id", linkId);
	} else if (scheduleId) {
		params.set("schedule_id", scheduleId);
	} else if (websiteId) {
		params.set("website_id", websiteId);
	} else if (organizationId) {
		params.set("organization_id", organizationId);
	}

	if (dateRange?.start_date) {
		params.append("start_date", dateRange.start_date);
	}

	if (dateRange?.end_date) {
		params.append("end_date", dateRange.end_date);
	}

	if (dateRange?.granularity) {
		params.append("granularity", dateRange.granularity);
	}

	params.append("_t", Date.now().toString());

	return params;
}

const defaultQueryOptions = {
	staleTime: 2 * 60 * 1000,
	gcTime: 30 * 60 * 1000,
	refetchOnWindowFocus: false,
	refetchOnMount: true,
	refetchInterval: 10 * 60 * 1000,
	retry: (failureCount: number, error: Error) => {
		if (error instanceof DOMException && error.name === "AbortError") {
			return false;
		}
		return failureCount < 2;
	},
	networkMode: "online" as const,
	refetchIntervalInBackground: false,
	placeholderData: undefined,
};

function transformFilters(filters?: DynamicQueryRequest["filters"]) {
	return filters?.map(({ field, operator, value }) => ({
		field,
		op: operator,
		value,
	}));
}

interface FetchOptions {
	linkId?: string;
	organizationId?: string;
	scheduleId?: string;
	websiteId?: string;
}

async function fetchDynamicQuery(
	idOrOptions: string | FetchOptions,
	dateRange: DateRange,
	queryData: DynamicQueryRequest | DynamicQueryRequest[],
	signal?: AbortSignal
): Promise<DynamicQueryResponse | BatchQueryResponse> {
	const timezone = guessTimezone();

const options: FetchOptions =
		typeof idOrOptions === "string" ? { websiteId: idOrOptions } : idOrOptions;

	const params = buildParams({
		websiteId: options.websiteId,
		scheduleId: options.scheduleId,
		linkId: options.linkId,
		organizationId: options.organizationId,
		dateRange,
		additionalParams: { timezone },
	});
	const url = `${API_BASE_URL}/v1/query?${params}`;

	const buildQuery = (query: DynamicQueryRequest) => ({
		...query,
		startDate: dateRange.start_date,
		endDate: dateRange.end_date,
		timeZone: timezone,
		limit: query.limit || 100,
		page: query.page || 1,
		filters: transformFilters(query.filters),
		granularity: query.granularity || dateRange.granularity || "daily",
		groupBy: query.groupBy,
	});

	const requestBody = Array.isArray(queryData)
		? queryData.map(buildQuery)
		: buildQuery(queryData);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		signal,
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch dynamic query data: ${response.statusText}`
		);
	}

	const data = await response.json();

	if (!data.success) {
		throw new Error(data.error || "Failed to fetch dynamic query data");
	}

	return data;
}

export function useDynamicQuery<
	TData extends Record<string, unknown[] | undefined> = Record<
		string,
		Record<string, unknown>[] | undefined
	>,
>(
	websiteId: string,
	dateRange: DateRange,
	queryData: DynamicQueryRequest,
	options?: Partial<UseQueryOptions<DynamicQueryResponse>>
) {
	const fetchData = useCallback(
		async ({ signal }: { signal?: AbortSignal }) => {
			const result = await fetchDynamicQuery(
				websiteId,
				dateRange,
				queryData,
				signal
			);
			return result as DynamicQueryResponse;
		},
		[websiteId, dateRange, queryData]
	);

	const query = useQuery({
		queryKey: ["dynamic-query", websiteId, dateRange, queryData],
		queryFn: fetchData,
		...defaultQueryOptions,
		...options,
		enabled:
			options?.enabled !== false &&
			!!websiteId &&
			queryData.parameters.length > 0,
	});

	const processedData = useMemo(() => {
		const acc: Record<string, any> = {};
		for (const result of query.data?.data ?? []) {
			if (result.success) {
				acc[result.parameter] = result.data;
			}
		}
		return acc as TData;
	}, [query.data]);

	return {
		data: processedData,
		isLoading: query.isLoading || query.isFetching || query.isPending,
		isError: query.isError,
		error: query.error,
	};
}

interface BatchQueryOptions {
	linkId?: string;
	organizationId?: string;
	scheduleId?: string;
	websiteId?: string;
}

export function useBatchDynamicQuery(
	idOrOptions: string | BatchQueryOptions,
	dateRange: DateRange,
	queries: DynamicQueryRequest[],
	options?: Partial<UseQueryOptions<BatchQueryResponse>>
) {
const queryOptions: BatchQueryOptions =
		typeof idOrOptions === "string" ? { websiteId: idOrOptions } : idOrOptions;

	const effectiveId =
		queryOptions.websiteId ||
		queryOptions.scheduleId ||
		queryOptions.linkId ||
		queryOptions.organizationId;

	const fetchData = useCallback(
		async ({ signal }: { signal?: AbortSignal }) => {
			const result = await fetchDynamicQuery(
				queryOptions,
				dateRange,
				queries,
				signal
			);
			return result as BatchQueryResponse;
		},
		[queryOptions, dateRange, queries]
	);

	const query = useQuery({
		queryKey: [
			"batch-dynamic-query",
			queryOptions.websiteId,
			queryOptions.scheduleId,
			queryOptions.linkId,
			queryOptions.organizationId,
			dateRange.start_date,
			dateRange.end_date,
			dateRange.granularity,
			dateRange.timezone,
			JSON.stringify(queries),
		],
		queryFn: fetchData,
		...defaultQueryOptions,
		...options,
		enabled: options?.enabled !== false && !!effectiveId && queries.length > 0,
	});

	const processedResults = useMemo(() => {
		if (!query.data?.results) {
			return [];
		}

		return query.data.results.map((result) => {
			const data: Record<string, any> = {};
			let success = false;

			if (result.data && Array.isArray(result.data)) {
				for (const paramResult of result.data) {
					if (paramResult.success && paramResult.data) {
						data[paramResult.parameter] = paramResult.data;
						success = true;
					}
				}
			}

			return { queryId: result.queryId, success, data };
		});
	}, [query.data]);

	const getDataForQuery = useCallback(
		(queryId: string, parameter: string) => {
			const result = processedResults.find((r) => r.queryId === queryId);
			if (!result?.success) {
				return [];
			}
			return result.data[parameter] || [];
		},
		[processedResults]
	);

	return {
		results: processedResults,
		isLoading: query.isLoading || query.isFetching || query.isPending,
		isError: query.isError,
		error: query.error,
		refetch: query.refetch,
		isFetching: query.isFetching,
		isPending: query.isPending,
		getDataForQuery,
	};
}
