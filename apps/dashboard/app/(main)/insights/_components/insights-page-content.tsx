"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useInsightsFeed } from "@/app/(main)/insights/hooks/use-insights-feed";
import { useInsightsLocalState } from "@/app/(main)/insights/hooks/use-insights-local-state";
import { StatCard } from "@/components/analytics/stat-card";
import { TopBar } from "@/components/layout/top-bar";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { DataTable } from "@/components/table/data-table";
import {
	createGeoColumns,
	createPageColumns,
	createReferrerColumns,
	type GeoEntry,
	type PageEntry,
	type ReferrerEntry,
} from "@/components/table/rows";
import { useBatchDynamicQuery } from "@/hooks/use-dynamic-query";
import { useWebsites } from "@/hooks/use-websites";
import { formatNumber } from "@/lib/formatters";
import {
	clearInsightsHistory,
	insightQueries,
	type InsightsAiResponse,
	type InsightsHistoryPage,
} from "@/lib/insight-api";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { insightsRangeAtom } from "../lib/time-range";
import { CockpitNarrative } from "./cockpit-narrative";
import { CockpitSignals } from "./cockpit-signals";
import { TimeRangeSelector } from "./time-range-selector";
import {
	ArrowClockwiseIcon,
	ChartLineIcon,
	CheckCircleIcon,
	CursorIcon,
	FunnelIcon,
	GlobeIcon,
	LightbulbIcon,
	TimerIcon,
	TrashIcon,
	UsersIcon,
	WarningCircleIcon,
} from "@databuddy/ui/icons";
import { DeleteDialog } from "@databuddy/ui/client";
import { Badge, Button, Card, EmptyState, dayjs } from "@databuddy/ui";

function rangeToDateRange(range: "7d" | "30d" | "90d") {
	const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
	return {
		start_date: dayjs()
			.subtract(days - 1, "day")
			.format("YYYY-MM-DD"),
		end_date: dayjs().format("YYYY-MM-DD"),
		granularity: "daily" as const,
	};
}

interface SummaryRow {
	bounce_rate?: number;
	median_session_duration?: number;
	pageviews?: number;
	sessions?: number;
	unique_visitors?: number;
}

function clampBounceRate(v: unknown): number {
	const n = Number(v ?? 0);
	if (Number.isNaN(n)) {
		return 0;
	}
	return Math.max(0, Math.min(100, n));
}

function formatDuration(value: number): string {
	if (!value || value < 60) {
		return `${Math.round(value || 0)}s`;
	}
	const minutes = Math.floor(value / 60);
	const seconds = Math.round(value % 60);
	return `${minutes}m ${seconds}s`;
}

export function InsightsPageContent() {
	const queryClient = useQueryClient();
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();
	const orgId = activeOrganization?.id ?? activeOrganizationId ?? undefined;

	const { insights, isLoading, isRefreshing, refetch } = useInsightsFeed();

	const range = useAtomValue(insightsRangeAtom);
	const { websites, isLoading: websitesLoading } = useWebsites();
	const websiteCount = websites.length;
	const hasWebsites = websiteCount > 0;

	const dateRange = useMemo(() => rangeToDateRange(range), [range]);
	const cockpitScope = useMemo(
		() => (orgId ? { organizationId: orgId } : {}),
		[orgId]
	);

	const queries = useMemo(
		() => [
			{
				id: "cockpit-summary",
				parameters: ["summary_metrics", "events_by_date"],
				limit: 100,
				granularity: dateRange.granularity,
			},
			{
				id: "cockpit-pages",
				parameters: ["top_pages"],
				limit: 8,
				granularity: dateRange.granularity,
			},
			{
				id: "cockpit-referrers",
				parameters: ["top_referrers"],
				limit: 8,
				granularity: dateRange.granularity,
			},
			{
				id: "cockpit-geo",
				parameters: ["country"],
				limit: 8,
				granularity: dateRange.granularity,
			},
		],
		[dateRange.granularity]
	);

	const {
		getDataForQuery,
		isLoading: cockpitLoading,
		refetch: refetchCockpit,
	} = useBatchDynamicQuery(cockpitScope, dateRange, queries, {
		enabled: Boolean(orgId) && !websitesLoading && hasWebsites,
	});

	const summary = (getDataForQuery("cockpit-summary", "summary_metrics") ??
		[])[0] as SummaryRow | undefined;
	const eventsByDate = (getDataForQuery("cockpit-summary", "events_by_date") ??
		[]) as Record<string, unknown>[];

	const topPages = (getDataForQuery("cockpit-pages", "top_pages") ??
		[]) as PageEntry[];
	const topReferrers = (getDataForQuery("cockpit-referrers", "top_referrers") ??
		[]) as ReferrerEntry[];
	const topCountries = (getDataForQuery("cockpit-geo", "country") ??
		[]) as GeoEntry[];

	const miniCharts = useMemo(() => {
		const build = (field: string, transform?: (value: number) => number) =>
			eventsByDate.map((row) => ({
				date: String(row.date ?? "").slice(0, 10),
				value: transform
					? transform(Number(row[field] ?? 0))
					: Number(row[field] ?? 0),
			}));
		return {
			visitors: build("visitors"),
			sessions: build("sessions"),
			pageviews: build("pageviews"),
			bounce: build("bounce_rate", clampBounceRate),
			duration: build("median_session_duration"),
		};
	}, [eventsByDate]);

	const pageColumns = useMemo(() => createPageColumns(), []);
	const referrerColumns = useMemo(() => createReferrerColumns(), []);
	const countryColumns = useMemo(
		() => createGeoColumns({ type: "country" }),
		[]
	);

	const insightIdsForVotes = useMemo(
		() => insights.map((i) => i.id),
		[insights]
	);

	const insightStats = useMemo(() => {
		const critical = insights.filter((i) => i.severity === "critical").length;
		const warning = insights.filter((i) => i.severity === "warning").length;
		const positive = insights.filter((i) => i.sentiment === "positive").length;
		const latest = insights.reduce<string | null>((acc, insight) => {
			if (!insight.createdAt) {
				return acc;
			}
			if (!acc) {
				return insight.createdAt;
			}
			return new Date(insight.createdAt).getTime() > new Date(acc).getTime()
				? insight.createdAt
				: acc;
		}, null);
		return {
			total: insights.length,
			positive,
			needsAttention: critical + warning,
			latest,
		};
	}, [insights]);

	const { clearAllDismissedAction } = useInsightsLocalState(
		orgId,
		insightIdsForVotes
	);

	const [clearDialogOpen, setClearDialogOpen] = useState(false);

	const clearInsightsMutation = useMutation({
		mutationFn: () => clearInsightsHistory(orgId ?? ""),
		onSuccess: async (data) => {
			setClearDialogOpen(false);
			clearAllDismissedAction();
			if (orgId) {
				const emptyAi: InsightsAiResponse = {
					success: true,
					insights: [],
					source: "ai",
				};
				const emptyHistoryPage: InsightsHistoryPage = {
					success: true,
					insights: [],
					hasMore: false,
				};
				queryClient.setQueryData<InsightsAiResponse>(
					insightQueries.ai(orgId).queryKey,
					emptyAi
				);
				queryClient.setQueryData(
					insightQueries.historyInfinite(orgId).queryKey,
					{ pages: [emptyHistoryPage], pageParams: [0] }
				);
				await queryClient.invalidateQueries({
					queryKey: orpc.insights.getVotes.key(),
				});
			}
			toast.success(
				data.deleted === 0
					? "No stored insights to remove"
					: `Removed ${data.deleted} insight${data.deleted === 1 ? "" : "s"}`
			);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Could not clear insights"
			);
		},
	});

	const handleRefreshAll = useCallback(() => {
		refetch();
		refetchCockpit();
	}, [refetch, refetchCockpit]);

	const hasNoWebsites =
		!websitesLoading && websites !== undefined && websites.length === 0;
	const isCockpitBusy = cockpitLoading || websitesLoading;

	return (
		<>
			<div
				aria-busy={isLoading || isCockpitBusy}
				className="flex h-full flex-col overflow-y-auto"
			>
				<TopBar.Title>
					<h1 className="font-semibold text-sm">Insights</h1>
				</TopBar.Title>
				<TopBar.Actions>
					<TimeRangeSelector />
					<Button
						aria-label="Refresh insights"
						disabled={isLoading || isCockpitBusy}
						onClick={handleRefreshAll}
						size="sm"
						type="button"
						variant="secondary"
					>
						<ArrowClockwiseIcon
							aria-hidden
							className={cn(
								"size-4 shrink-0",
								(isRefreshing || cockpitLoading) && "animate-spin"
							)}
						/>
					</Button>
					<Button
						disabled={!orgId || clearInsightsMutation.isPending}
						onClick={() => setClearDialogOpen(true)}
						size="sm"
						type="button"
						variant="secondary"
					>
						<TrashIcon className="size-4 shrink-0" weight="duotone" />
						Clear all
					</Button>
				</TopBar.Actions>

				{hasNoWebsites ? (
					<EmptyOrgState />
				) : (
					<div className="space-y-4 p-4 sm:p-5">
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
							<CockpitNarrative />
							<InsightEngineStatus
								cockpitLoading={isCockpitBusy}
								insightStats={insightStats}
								range={range}
								websiteCount={websiteCount}
							/>
						</div>

						<div className="grid grid-cols-1 gap-1.5 rounded-xl bg-secondary p-1.5 sm:grid-cols-2 lg:grid-cols-5">
							<StatCard
								chartData={cockpitLoading ? undefined : miniCharts.visitors}
								formatValue={formatNumber}
								icon={UsersIcon}
								id="cockpit-visitors"
								isLoading={cockpitLoading}
								showChart
								title="Visitors"
								value={
									summary?.unique_visitors
										? formatNumber(summary.unique_visitors)
										: "0"
								}
							/>
							<StatCard
								chartData={cockpitLoading ? undefined : miniCharts.sessions}
								formatValue={formatNumber}
								icon={ChartLineIcon}
								id="cockpit-sessions"
								isLoading={cockpitLoading}
								showChart
								title="Sessions"
								value={summary?.sessions ? formatNumber(summary.sessions) : "0"}
							/>
							<StatCard
								chartData={cockpitLoading ? undefined : miniCharts.pageviews}
								formatValue={formatNumber}
								icon={GlobeIcon}
								id="cockpit-pageviews"
								isLoading={cockpitLoading}
								showChart
								title="Pageviews"
								value={
									summary?.pageviews ? formatNumber(summary.pageviews) : "0"
								}
							/>
							<StatCard
								chartData={cockpitLoading ? undefined : miniCharts.bounce}
								formatValue={(v) => `${v.toFixed(1)}%`}
								icon={CursorIcon}
								id="cockpit-bounce"
								invertTrend
								isLoading={cockpitLoading}
								showChart
								title="Bounce rate"
								value={
									summary?.bounce_rate == null
										? "0%"
										: `${clampBounceRate(summary.bounce_rate).toFixed(1)}%`
								}
							/>
							<StatCard
								chartData={cockpitLoading ? undefined : miniCharts.duration}
								formatChartValue={formatDuration}
								formatValue={formatDuration}
								icon={TimerIcon}
								id="cockpit-duration"
								isLoading={cockpitLoading}
								showChart
								title="Session duration"
								value={formatDuration(summary?.median_session_duration ?? 0)}
							/>
						</div>

						<div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
							<DataTable
								columns={pageColumns}
								data={topPages}
								description="Most-visited pages across every website"
								isLoading={cockpitLoading}
								minHeight={320}
								title="Global top pages"
							/>
							<DataTable
								columns={referrerColumns}
								data={topReferrers}
								description="Top acquisition sources across the organization"
								isLoading={cockpitLoading}
								minHeight={320}
								title="Global top referrers"
							/>
						</div>

						<DataTable
							columns={countryColumns}
							data={topCountries}
							description="Audience by country across every website"
							isLoading={cockpitLoading}
							minHeight={320}
							title="Global top countries"
						/>

						<CockpitSignals />
					</div>
				)}
			</div>

			<DeleteDialog
				confirmDisabled={!orgId}
				confirmLabel="Clear all"
				description="This removes every stored insight for this organization from the database. Fresh insights will be generated on the next analysis run."
				isDeleting={clearInsightsMutation.isPending}
				isOpen={clearDialogOpen}
				onClose={() => setClearDialogOpen(false)}
				onConfirm={async () => {
					if (orgId) {
						await clearInsightsMutation.mutateAsync();
					}
				}}
				title="Clear all insights?"
			/>
		</>
	);
}

interface InsightEngineStatusProps {
	cockpitLoading: boolean;
	insightStats: {
		latest: string | null;
		needsAttention: number;
		positive: number;
		total: number;
	};
	range: "7d" | "30d" | "90d";
	websiteCount: number;
}

function InsightEngineStatus({
	cockpitLoading,
	insightStats,
	range,
	websiteCount,
}: InsightEngineStatusProps) {
	const hasAttention = insightStats.needsAttention > 0;
	const operationRows = [
		{
			label: "Coverage",
			value: `${formatNumber(websiteCount)} ${
				websiteCount === 1 ? "website" : "websites"
			}`,
		},
		{
			label: "Window",
			value:
				range === "7d"
					? "Last 7 days"
					: range === "30d"
						? "Last 30 days"
						: "Last 90 days",
		},
		{
			label: "Signals",
			value: `${formatNumber(insightStats.total)} ranked`,
		},
		{
			label: "Review queue",
			value: hasAttention
				? `${formatNumber(insightStats.needsAttention)} need attention`
				: "No urgent signals",
		},
	];

	return (
		<Card aria-label="Insight engine status" className="min-h-full">
			<Card.Header className="flex-row items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<LightbulbIcon
							aria-hidden
							className="size-4 text-primary"
							weight="duotone"
						/>
						<Card.Title className="text-sm">Insight engine</Card.Title>
					</div>
					<Card.Description>
						Global analysis across the organization
					</Card.Description>
				</div>
				<Badge variant={hasAttention ? "warning" : "success"}>
					{hasAttention ? "Reviewing" : "Healthy"}
				</Badge>
			</Card.Header>
			<Card.Content className="space-y-4">
				<div aria-hidden className="flex h-8 items-end gap-1">
					{Array.from({ length: 34 }).map((_, index) => (
						<span
							className={cn(
								"h-6 w-1 rounded-full bg-success transition-opacity",
								cockpitLoading || index % 5 !== 0 ? "opacity-80" : "opacity-35"
							)}
							key={index}
						/>
					))}
				</div>

				<div className="grid grid-cols-3 gap-2">
					<EngineMiniStat
						label="Active"
						value={formatNumber(insightStats.total)}
					/>
					<EngineMiniStat
						label="Attention"
						tone={hasAttention ? "warning" : "success"}
						value={formatNumber(insightStats.needsAttention)}
					/>
					<EngineMiniStat
						label="Positive"
						tone="success"
						value={formatNumber(insightStats.positive)}
					/>
				</div>

				<div className="rounded-md border border-border/60 bg-muted/40">
					{operationRows.map((row) => (
						<div
							className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
							key={row.label}
						>
							<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
								<CheckCircleIcon
									aria-hidden
									className="size-3.5 shrink-0 text-success"
									weight="fill"
								/>
								{row.label}
							</span>
							<span className="truncate font-medium text-foreground text-xs">
								{row.value}
							</span>
						</div>
					))}
				</div>

				<div className="flex items-start gap-2 border-border/60 border-t pt-3">
					{hasAttention ? (
						<WarningCircleIcon
							aria-hidden
							className="mt-0.5 size-4 shrink-0 text-warning"
							weight="duotone"
						/>
					) : (
						<FunnelIcon
							aria-hidden
							className="mt-0.5 size-4 shrink-0 text-primary"
							weight="duotone"
						/>
					)}
					<p className="text-pretty text-muted-foreground text-xs leading-relaxed">
						{hasAttention
							? "The feed is prioritizing negative and warning signals first, with the latest evidence pulled into the tables below."
							: "The feed is still scanning for traffic, conversion, acquisition, and reliability changes worth surfacing."}
						{insightStats.latest
							? ` Latest signal ${dayjs(insightStats.latest).fromNow(true)} ago.`
							: ""}
					</p>
				</div>
			</Card.Content>
		</Card>
	);
}

function EngineMiniStat({
	label,
	value,
	tone = "default",
}: {
	label: string;
	tone?: "default" | "success" | "warning";
	value: string;
}) {
	return (
		<div
			className={cn(
				"rounded-md border border-border/60 bg-background px-3 py-2",
				tone === "success" && "bg-success/5",
				tone === "warning" && "bg-warning/5"
			)}
		>
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="mt-1 font-semibold text-foreground text-sm tabular-nums">
				{value}
			</p>
		</div>
	);
}

function EmptyOrgState() {
	return (
		<EmptyState
			action={{
				label: "Go to websites",
				onClick: () => {
					window.location.href = "/websites";
				},
			}}
			description="Add a website to see insights across your organization."
			icon={<GlobeIcon weight="duotone" />}
			title="No websites yet"
			variant="minimal"
		/>
	);
}
