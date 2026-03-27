"use client";

import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { getUserTimezone } from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const STALE_TIME = 15 * 60 * 1000;
const GC_TIME = 30 * 60 * 1000;
const HISTORY_STALE_TIME = 5 * 60 * 1000;
const INSIGHTS_MAX = 20;

const QUERY_AI = "ai-insights";
const QUERY_HISTORY = "insights-history";

export type InsightType =
	| "error_spike"
	| "new_errors"
	| "vitals_degraded"
	| "custom_event_spike"
	| "traffic_drop"
	| "traffic_spike"
	| "bounce_rate_change"
	| "engagement_change"
	| "referrer_change"
	| "page_trend"
	| "positive_trend"
	| "performance"
	| "uptime_issue";

export type InsightSeverity = "critical" | "warning" | "info";

export type InsightSentiment = "positive" | "neutral" | "negative";

/** Where this row came from when merging AI + history feeds. */
export type InsightSource = "ai" | "history";

export interface Insight {
	id: string;
	type: InsightType;
	severity: InsightSeverity;
	sentiment: InsightSentiment;
	priority: number;
	websiteId: string;
	websiteName: string | null;
	websiteDomain: string;
	title: string;
	description: string;
	suggestion: string;
	changePercent?: number;
	link: string;
	insightSource?: InsightSource;
	createdAt?: string;
	currentPeriodFrom?: string | null;
	currentPeriodTo?: string | null;
	previousPeriodFrom?: string | null;
	previousPeriodTo?: string | null;
	timezone?: string | null;
}

interface InsightsAiResponse {
	success: boolean;
	insights: Insight[];
	source: "ai" | "fallback";
}

export interface HistoryInsightRow {
	id: string;
	type: string;
	severity: string;
	sentiment: string;
	priority: number;
	websiteId: string;
	websiteName: string | null;
	websiteDomain: string;
	title: string;
	description: string;
	suggestion: string;
	changePercent?: number | null;
	link: string;
	createdAt?: string;
	currentPeriodFrom?: string | null;
	currentPeriodTo?: string | null;
	previousPeriodFrom?: string | null;
	previousPeriodTo?: string | null;
	timezone?: string | null;
}

interface InsightsHistoryResponse {
	success: boolean;
	insights: HistoryInsightRow[];
	hasMore: boolean;
}

export function mapHistoryRowToInsight(row: HistoryInsightRow): Insight {
	return {
		id: row.id,
		type: row.type as InsightType,
		severity: row.severity as InsightSeverity,
		sentiment: row.sentiment as InsightSentiment,
		priority: row.priority,
		websiteId: row.websiteId,
		websiteName: row.websiteName,
		websiteDomain: row.websiteDomain,
		title: row.title,
		description: row.description,
		suggestion: row.suggestion,
		changePercent: row.changePercent ?? undefined,
		link: row.link,
		insightSource: "history",
		createdAt: row.createdAt ?? undefined,
		currentPeriodFrom: row.currentPeriodFrom,
		currentPeriodTo: row.currentPeriodTo,
		previousPeriodFrom: row.previousPeriodFrom,
		previousPeriodTo: row.previousPeriodTo,
		timezone: row.timezone,
	};
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

async function fetchInsightsHistory(
	organizationId: string
): Promise<InsightsHistoryResponse> {
	const params = new URLSearchParams({
		organizationId,
		limit: String(INSIGHTS_MAX),
		offset: "0",
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

	return (await res.json()) as InsightsHistoryResponse;
}

function mergeInsights(fresh: Insight[], stored: Insight[]): Insight[] {
	const seen = new Set<string>();
	const out: Insight[] = [];
	for (const i of [...fresh, ...stored]) {
		if (!seen.has(i.id)) {
			seen.add(i.id);
			out.push(i);
			if (out.length >= INSIGHTS_MAX) {
				break;
			}
		}
	}
	return out;
}

export function useSmartInsights() {
	const queryClient = useQueryClient();
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();

	const orgId = activeOrganization?.id ?? activeOrganizationId ?? undefined;

	const historyQuery = useQuery({
		queryKey: [QUERY_HISTORY, orgId],
		queryFn: () => fetchInsightsHistory(orgId ?? ""),
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
		const stored = (historyQuery.data?.insights ?? []).map(
			mapHistoryRowToInsight
		);
		return mergeInsights(fresh, stored);
	}, [aiQuery.data?.insights, historyQuery.data?.insights]);

	const refetchInsights = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: [QUERY_HISTORY, orgId] }),
			queryClient.invalidateQueries({ queryKey: [QUERY_AI, orgId] }),
		]);
	}, [queryClient, orgId]);

	const bothQueriesPending =
		historyQuery.isPending && aiQuery.isPending && mergedInsights.length === 0;

	const isInitialLoading = bothQueriesPending;

	const showAnalyzing =
		mergedInsights.length === 0 && aiQuery.isPending && !isInitialLoading;

	const isError =
		mergedInsights.length === 0 &&
		!historyQuery.isPending &&
		!aiQuery.isPending &&
		(historyQuery.isError || aiQuery.isError);

	const isFetching = historyQuery.isFetching || aiQuery.isFetching;

	const isFetchingFresh = mergedInsights.length > 0 && aiQuery.isFetching;

	return {
		insights: mergedInsights,
		source: aiQuery.data?.source ?? null,
		isLoading: isInitialLoading,
		showAnalyzing,
		isFetching,
		isFetchingFresh,
		isError,
		refetch: refetchInsights,
	};
}
