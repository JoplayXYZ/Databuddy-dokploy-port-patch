"use client";

import {
	ArrowClockwiseIcon,
	CaretDownIcon,
	CheckCircleIcon,
	FunnelIcon,
	SparkleIcon,
	WarningCircleIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	Insight,
	InsightSeverity,
} from "@/lib/insight-types";
import { useInsightsFeed } from "@/app/(main)/insights/hooks/use-insights-feed";
import { useInsightsLocalState } from "@/app/(main)/insights/hooks/use-insights-local-state";
import { PageHeader } from "@/app/(main)/websites/_components/page-header";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InsightCard, InsightCardSkeleton } from "./insight-card";

type SeverityFilter = "all" | InsightSeverity;

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
	{ value: "all", label: "All severities" },
	{ value: "critical", label: "Critical" },
	{ value: "warning", label: "Warning" },
	{ value: "info", label: "Info" },
];

function groupInsightsByWebsite(
	items: Insight[]
): Array<{ websiteId: string; name: string; items: Insight[] }> {
	const map = new Map<string, { name: string; items: Insight[] }>();
	for (const i of items) {
		const name = i.websiteName ?? i.websiteDomain;
		const existing = map.get(i.websiteId);
		if (existing) {
			existing.items.push(i);
		} else {
			map.set(i.websiteId, { name, items: [i] });
		}
	}
	return [...map.entries()]
		.map(([websiteId, v]) => ({ websiteId, ...v }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function InsightsPageContent() {
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();
	const orgId = activeOrganization?.id ?? activeOrganizationId ?? undefined;

	const {
		insights,
		isLoading,
		showAnalyzing,
		isFetching,
		isFetchingFresh,
		isError,
		refetch,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInsightsFeed();

	const insightIdsForVotes = useMemo(
		() => insights.map((i) => i.id),
		[insights]
	);

	const {
		hydrated,
		dismissedIdSet,
		dismissAction,
		clearAllDismissedAction,
		feedbackById,
		setFeedbackAction,
	} = useInsightsLocalState(orgId, insightIdsForVotes);

	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [websiteFilter, setWebsiteFilter] = useState("all");
	const [grouped, setGrouped] = useState(false);
	const [showDismissed, setShowDismissed] = useState(false);

	const websites = useMemo(() => {
		const map = new Map<string, string>();
		for (const i of insights) {
			if (!map.has(i.websiteId)) {
				map.set(i.websiteId, i.websiteName ?? i.websiteDomain);
			}
		}
		return [...map.entries()].map(([id, name]) => ({ id, name }));
	}, [insights]);

	const filteredInsights = useMemo(() => {
		return insights.filter((i) => {
			if (!showDismissed && dismissedIdSet.has(i.id)) {
				return false;
			}
			if (severityFilter !== "all" && i.severity !== severityFilter) {
				return false;
			}
			if (websiteFilter !== "all" && i.websiteId !== websiteFilter) {
				return false;
			}
			return true;
		});
	}, [insights, severityFilter, websiteFilter, dismissedIdSet, showDismissed]);

	const counts = useMemo(
		() => ({
			total: insights.length,
			critical: insights.filter((i) => i.severity === "critical").length,
			warning: insights.filter((i) => i.severity === "warning").length,
			info: insights.filter((i) => i.severity === "info").length,
		}),
		[insights]
	);

	const busy = isLoading || isFetching;
	const hasActiveFilters = severityFilter !== "all" || websiteFilter !== "all";

	const clearFilters = () => {
		setSeverityFilter("all");
		setWebsiteFilter("all");
	};

	const selectedWebsiteName =
		websiteFilter === "all"
			? "All Websites"
			: (websites.find((w) => w.id === websiteFilter)?.name ?? "All Websites");

	const selectedSeverityLabel =
		SEVERITY_OPTIONS.find((o) => o.value === severityFilter)?.label ??
		"All severities";

	const listScrollRef = useRef<HTMLDivElement>(null);
	const hasScrolledToHash = useRef(false);

	const scrollToHashInsight = useCallback(() => {
		if (typeof window === "undefined") {
			return;
		}
		const raw = window.location.hash.slice(1);
		if (!raw.startsWith("insight-")) {
			return;
		}
		const el = document.getElementById(raw);
		const container = listScrollRef.current;
		if (!(el && container)) {
			return;
		}
		requestAnimationFrame(() => {
			const containerRect = container.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			const nextTop = container.scrollTop + (elRect.top - containerRect.top);
			container.scrollTo({ behavior: "smooth", top: nextTop });
		});
	}, []);

	useEffect(() => {
		if (hasScrolledToHash.current || !hydrated || isLoading || filteredInsights.length === 0) {
			return;
		}
		hasScrolledToHash.current = true;
		scrollToHashInsight();
	}, [hydrated, isLoading, filteredInsights.length, scrollToHashInsight]);

	const groupedInsights = useMemo(
		() => groupInsightsByWebsite(filteredInsights),
		[filteredInsights]
	);

	const renderInsightRow = (insight: Insight) => (
		<InsightCard
			feedbackVote={feedbackById[insight.id] ?? null}
			insight={insight}
			key={insight.id}
			onDismissAction={() => dismissAction(insight.id)}
			onFeedbackAction={(vote) => setFeedbackAction(insight.id, vote)}
		/>
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<PageHeader
				count={isLoading ? undefined : insights.length}
				description="Week-over-week AI analysis across all your websites"
				icon={<SparkleIcon weight="duotone" />}
				right={
					<div className="flex items-center gap-2">
						{websites.length > 1 && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										className="min-w-[140px] justify-between"
										disabled={busy}
										variant="outline"
									>
										<span className="truncate">{selectedWebsiteName}</span>
										<CaretDownIcon className="ml-2 size-4" weight="fill" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-[200px]">
									<DropdownMenuItem onClick={() => setWebsiteFilter("all")}>
										All Websites
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									{websites.map((w) => (
										<DropdownMenuItem
											key={w.id}
											onClick={() => setWebsiteFilter(w.id)}
										>
											{w.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						<Button
							aria-label="Refresh insights"
							disabled={busy}
							onClick={() => refetch()}
							size="icon"
							variant="secondary"
						>
							<ArrowClockwiseIcon
								aria-hidden
								className={cn("size-4", busy && "animate-spin")}
							/>
						</Button>
					</div>
				}
				title="Insights"
			/>

			<div
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6"
				ref={listScrollRef}
			>
				{isLoading && (
					<div className="rounded border bg-card">
						<div className="flex items-center gap-3 border-b px-4 py-3">
							<SparkleIcon
								className="size-4 animate-pulse text-primary"
								weight="duotone"
							/>
							<div>
								<p className="font-medium text-foreground text-sm">
									Analyzing your websites…
								</p>
								<p className="text-muted-foreground text-xs">
									Databunny is comparing week-over-week data
								</p>
							</div>
						</div>
						<div className="divide-y">
							<InsightCardSkeleton />
							<InsightCardSkeleton />
							<InsightCardSkeleton />
						</div>
					</div>
				)}

				{!isLoading && isError && <ErrorState onRetryAction={refetch} />}

				{!(isLoading || isError) && showAnalyzing && (
					<div className="rounded border bg-card">
						<div className="flex items-center gap-3 border-b px-4 py-3">
							<SparkleIcon
								className="size-4 animate-pulse text-primary"
								weight="duotone"
							/>
							<div>
								<p className="font-medium text-foreground text-sm">
									Running analysis…
								</p>
								<p className="text-muted-foreground text-xs">
									Checking traffic, errors, and performance across your sites
								</p>
							</div>
						</div>
						<div className="divide-y">
							<InsightCardSkeleton />
							<InsightCardSkeleton />
						</div>
					</div>
				)}

				{!(isLoading || isError || showAnalyzing) && (
					<>
						{insights.length === 0 && <AllHealthyState />}

						{insights.length > 0 && (
							<div className="rounded border bg-card">
								<div className="flex items-center justify-between border-b px-4 py-2.5">
									<div className="flex items-center gap-2">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													className={cn(
														"flex items-center gap-1.5 rounded px-2 py-1 font-medium text-xs transition-colors",
														severityFilter === "all"
															? "text-muted-foreground hover:text-foreground"
															: "bg-primary/10 text-primary"
													)}
													type="button"
												>
													<FunnelIcon className="size-3.5" />
													{selectedSeverityLabel}
													<CaretDownIcon className="size-3" weight="fill" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start">
												{SEVERITY_OPTIONS.map((opt) => {
													const count =
														opt.value === "all" ? counts.total : counts[opt.value];
													if (opt.value !== "all" && count === 0) {
														return null;
													}
													return (
														<DropdownMenuItem
															key={opt.value}
															onClick={() => setSeverityFilter(opt.value)}
														>
															<span className="flex-1">{opt.label}</span>
															<span className="font-mono text-muted-foreground text-xs tabular-nums">
																{count}
															</span>
														</DropdownMenuItem>
													);
												})}
											</DropdownMenuContent>
										</DropdownMenu>

										<div className="flex items-center gap-1 rounded border border-border/60 bg-background/50 p-0.5">
											<button
												className={cn(
													"rounded px-2 py-0.5 font-medium text-xs transition-colors",
													!grouped
														? "bg-accent text-foreground"
														: "text-muted-foreground hover:text-foreground"
												)}
												onClick={() => setGrouped(false)}
												type="button"
											>
												Flat
											</button>
											<button
												className={cn(
													"rounded px-2 py-0.5 font-medium text-xs transition-colors",
													grouped
														? "bg-accent text-foreground"
														: "text-muted-foreground hover:text-foreground"
												)}
												onClick={() => setGrouped(true)}
												type="button"
											>
												By site
											</button>
										</div>

										{dismissedIdSet.size > 0 && (
											<button
												className={cn(
													"text-xs transition-colors",
													showDismissed
														? "font-medium text-foreground"
														: "text-muted-foreground hover:text-foreground"
												)}
												onClick={() => setShowDismissed((v) => !v)}
												type="button"
											>
												{showDismissed
													? "Hide dismissed"
													: `Show dismissed (${dismissedIdSet.size})`}
											</button>
										)}
									</div>

									<div className="flex items-center gap-2">
										{isFetchingFresh && (
											<span className="text-muted-foreground text-xs">Updating…</span>
										)}
										{hasActiveFilters && (
											<button
												className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
												onClick={clearFilters}
												type="button"
											>
												<XIcon className="size-3" />
												Clear
											</button>
										)}
									</div>
								</div>

								{filteredInsights.length > 0 && !grouped && (
									<div className="divide-y">
										{filteredInsights.map(renderInsightRow)}
									</div>
								)}

								{filteredInsights.length > 0 && grouped && (
									<div className="divide-y">
										{groupedInsights.map((group) => (
											<div key={group.websiteId}>
												<div className="bg-accent/30 px-4 py-2 sm:px-6">
													<h2 className="font-semibold text-foreground text-xs">
														<span className="text-balance">{group.name}</span>
														<span className="ml-2 font-normal text-muted-foreground tabular-nums">
															({group.items.length})
														</span>
													</h2>
												</div>
												<div className="divide-y">
													{group.items.map(renderInsightRow)}
												</div>
											</div>
										))}
									</div>
								)}

								{filteredInsights.length === 0 && (
									<NoMatchState
										onClearAction={clearFilters}
										onShowDismissedAction={
											dismissedIdSet.size > 0
												? () => setShowDismissed(true)
												: undefined
										}
									/>
								)}
							</div>
						)}

						{hasNextPage && (
							<div className="mt-4 flex justify-center">
								<Button
									disabled={isFetchingNextPage}
									onClick={() => fetchNextPage()}
									type="button"
									variant="outline"
								>
									{isFetchingNextPage ? (
										<>
											<ArrowClockwiseIcon className="size-4 animate-spin" />
											Loading…
										</>
									) : (
										"Load more history"
									)}
								</Button>
							</div>
						)}

						{hydrated && dismissedIdSet.size > 0 && (
							<div className="mt-6 flex justify-center">
								<Button
									onClick={clearAllDismissedAction}
									type="button"
									variant="ghost"
								>
									Clear all dismissed
								</Button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function ErrorState({ onRetryAction }: { onRetryAction: () => void }) {
	return (
		<div className="rounded border bg-card">
			<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
					<WarningCircleIcon className="size-5 text-red-500" weight="duotone" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground">Couldn't load insights</p>
					<p className="text-muted-foreground text-sm">
						AI analysis timed out or failed. Try again.
					</p>
				</div>
				<Button onClick={onRetryAction} size="sm" variant="outline">
					<ArrowClockwiseIcon className="size-4" />
					Retry
				</Button>
			</div>
		</div>
	);
}

function AllHealthyState() {
	return (
		<div className="rounded border bg-card">
			<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
					<CheckCircleIcon className="size-5 text-emerald-500" weight="fill" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground">All systems healthy</p>
					<p className="text-pretty text-muted-foreground text-sm">
						No actionable insights detected across your websites this week
					</p>
				</div>
			</div>
		</div>
	);
}

function NoMatchState({
	onClearAction,
	onShowDismissedAction,
}: {
	onClearAction: () => void;
	onShowDismissedAction?: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent">
				<FunnelIcon className="size-5 text-muted-foreground" weight="duotone" />
			</div>
			<div className="space-y-1">
				<p className="font-medium text-foreground">No matching insights</p>
				<p className="text-muted-foreground text-sm">
					Try adjusting your filters
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-2">
				<Button onClick={onClearAction} size="sm" variant="outline">
					Clear filters
				</Button>
				{onShowDismissedAction && (
					<Button
						onClick={onShowDismissedAction}
						size="sm"
						type="button"
						variant="secondary"
					>
						Show dismissed
					</Button>
				)}
			</div>
		</div>
	);
}
