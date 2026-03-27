"use client";

import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	type HistoryInsightRow,
	type Insight,
	mapHistoryRowToInsight,
} from "@/app/(main)/home/hooks/use-smart-insights";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { getUserTimezone } from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const STALE_TIME = 15 * 60 * 1000;
const GC_TIME = 30 * 60 * 1000;
const HISTORY_STALE_TIME = 5 * 60 * 1000;
const HISTORY_PAGE_SIZE = 50;

const QUERY_AI = "ai-insights";
const QUERY_HISTORY_INFINITE = "insights-history-infinite";

interface InsightsHistoryPage {
	success: boolean;
	insights: HistoryInsightRow[];
	hasMore: boolean;
}

interface InsightsAiResponse {
	success: boolean;
	insights: Insight[];
	source: "ai" | "fallback";
}

async function fetchInsightsAi(
	organizationId: string
): Promise<InsightsAiResponse> {
	const res = await fetch(`${API_URL}/v1/insights/ai`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organizationId, timezone: getUserTimezone() }),
		signal: AbortSignal.timeout(90_000),
	});

	if (!res.ok) {
		throw new Error(`Insights request failed: ${res.status}`);
	}

	const data = (await res.json()) as InsightsAiResponse;

	if (!data.success) {
		throw new Error("Insights response unsuccessful");
	}

	return data;
}

async function fetchInsightsHistoryPage(
	organizationId: string,
	offset: number
): Promise<InsightsHistoryPage> {
	const params = new URLSearchParams({
		organizationId,
		limit: String(HISTORY_PAGE_SIZE),
		offset: String(offset),
	});
	const res = await fetch(
		`${API_URL}/v1/insights/history?${params.toString()}`,
		{
			credentials: "include",
			signal: AbortSignal.timeout(30_000),
		}
	);

	if (!res.ok) {
		throw new Error(`Insights history failed: ${res.status}`);
	}

	return (await res.json()) as InsightsHistoryPage;
}

function mergeAiWithHistoryPages(
	ai: Insight[],
	historyPages: InsightsHistoryPage[]
): Insight[] {
	const seen = new Set<string>();
	const out: Insight[] = [];

	for (const i of ai) {
		if (!seen.has(i.id)) {
			seen.add(i.id);
			out.push(i);
		}
	}

	for (const page of historyPages) {
		for (const row of page.insights) {
			const mapped = mapHistoryRowToInsight(row);
			if (!seen.has(mapped.id)) {
				seen.add(mapped.id);
				out.push(mapped);
			}
		}
	}

	return out;
}

export function useInsightsFeed() {
	const queryClient = useQueryClient();
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();

	const orgId = activeOrganization?.id ?? activeOrganizationId ?? undefined;

	const historyInfinite = useInfiniteQuery({
		queryKey: [QUERY_HISTORY_INFINITE, orgId],
		queryFn: ({ pageParam }) =>
			fetchInsightsHistoryPage(orgId ?? "", pageParam as number),
		initialPageParam: 0,
		getNextPageParam: (lastPage, _allPages, lastPageParam) => {
			if (!lastPage.hasMore) {
				return undefined;
			}
			return (lastPageParam as number) + HISTORY_PAGE_SIZE;
		},
		enabled: !!orgId,
		staleTime: HISTORY_STALE_TIME,
		gcTime: GC_TIME,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
		retry: 2,
		retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15_000),
	});

	const aiQuery = useQuery({
		queryKey: [QUERY_AI, orgId],
		queryFn: () => fetchInsightsAi(orgId ?? ""),
		enabled: !!orgId,
		staleTime: STALE_TIME,
		gcTime: GC_TIME,
		refetchInterval: STALE_TIME,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
		retry: 2,
		retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15_000),
	});

	const mergedInsights = useMemo(() => {
		const fresh = (aiQuery.data?.insights ?? []).map(
			(i): Insight => ({
				...i,
				insightSource: "ai",
			})
		);
		const pages = historyInfinite.data?.pages ?? [];
		return mergeAiWithHistoryPages(fresh, pages);
	}, [aiQuery.data?.insights, historyInfinite.data?.pages]);

	const refetchAll = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: [QUERY_HISTORY_INFINITE, orgId],
			}),
			queryClient.invalidateQueries({ queryKey: [QUERY_AI, orgId] }),
		]);
	}, [queryClient, orgId]);

	const bothPending =
		historyInfinite.isPending &&
		aiQuery.isPending &&
		mergedInsights.length === 0;

	const isInitialLoading = bothPending;

	const showAnalyzing =
		mergedInsights.length === 0 && aiQuery.isPending && !isInitialLoading;

	const isError =
		mergedInsights.length === 0 &&
		!historyInfinite.isPending &&
		!aiQuery.isPending &&
		(historyInfinite.isError || aiQuery.isError);

	const isFetching = historyInfinite.isFetching || aiQuery.isFetching;

	const isFetchingFresh = mergedInsights.length > 0 && aiQuery.isFetching;

	return {
		insights: mergedInsights,
		source: aiQuery.data?.source ?? null,
		isLoading: isInitialLoading,
		showAnalyzing,
		isFetching,
		isFetchingFresh,
		isError,
		refetch: refetchAll,
		fetchNextPage: historyInfinite.fetchNextPage,
		hasNextPage: historyInfinite.hasNextPage ?? false,
		isFetchingNextPage: historyInfinite.isFetchingNextPage,
	};
}
