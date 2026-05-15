"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { NoticeBanner } from "@/app/(main)/websites/_components/notice-banner";
import { LiveUserIndicator } from "@/components/analytics";
import { TopBar } from "@/components/layout/top-bar";
import { WebsiteErrorState } from "@/components/website-error-state";
import {
	batchDynamicQueryKeys,
	dynamicQueryKeys,
} from "@/hooks/use-dynamic-query";
import { useWebsite } from "@/hooks/use-websites";
import {
	DASHBOARD_FILTERS_QUERY_PARAM,
	parseDashboardFiltersParam,
	serializeDashboardFilters,
} from "@/lib/dashboard-navigation-actions";
import { cn } from "@/lib/utils";
import {
	addDynamicFilterAtom,
	currentFilterWebsiteIdAtom,
	dynamicQueryFiltersAtom,
	isAnalyticsRefreshingAtom,
} from "@/stores/jotai/filterAtoms";
import { AnalyticsDateControls } from "./_components/analytics-date-controls";
import { AnalyticsToolbar } from "./_components/analytics-toolbar";
import { AddFilterForm } from "./_components/filters/add-filters";
import { FiltersSection } from "./_components/filters/filters-section";
import { SavedFiltersToolbar } from "./_components/filters/saved-filters-toolbar";
import { WebsiteTrackingSetupTab } from "./_components/tabs/tracking-setup-tab";
import { useTrackingSetup } from "./hooks/use-tracking-setup";
import { ArrowClockwiseIcon, WarningCircleIcon } from "@databuddy/ui/icons";
import { Button } from "@databuddy/ui";

const ROUTES_WITHOUT_ANALYTICS_TOOLBAR = new Set([
	"agent",
	"flags",
	"map",
	"pulse",
	"realtime",
	"settings",
	"users",
]);

function shouldHideAnalyticsToolbar(
	pathname: string,
	isEmbed: boolean
): boolean {
	if (isEmbed) {
		return true;
	}

	const [, routeGroup, , section] = pathname.split("/");
	if (routeGroup !== "websites" && routeGroup !== "demo") {
		return false;
	}

	return section != null && ROUTES_WITHOUT_ANALYTICS_TOOLBAR.has(section);
}

interface WebsiteLayoutProps {
	children: React.ReactNode;
}

export default function WebsiteLayout({ children }: WebsiteLayoutProps) {
	const { id } = useParams();
	const websiteId = id as string;
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const [isRefreshing, setIsRefreshing] = useAtom(isAnalyticsRefreshingAtom);
	const setCurrentFilterWebsiteId = useSetAtom(currentFilterWebsiteIdAtom);
	const [dynamicFilters, setDynamicFilters] = useAtom(dynamicQueryFiltersAtom);
	const [isEmbed] = useQueryState("embed", parseAsBoolean.withDefault(false));
	const [filtersParam, setFiltersParam] = useQueryState(
		DASHBOARD_FILTERS_QUERY_PARAM,
		parseAsString
	);
	const [, addFilter] = useAtom(addDynamicFilterAtom);
	const serializedDynamicFilters = useMemo(
		() =>
			dynamicFilters.length > 0
				? serializeDashboardFilters(dynamicFilters)
				: null,
		[dynamicFilters]
	);

	useEffect(() => {
		setCurrentFilterWebsiteId(websiteId);
	}, [websiteId, setCurrentFilterWebsiteId]);

	useEffect(() => {
		const parsedFilters = parseDashboardFiltersParam(filtersParam);
		if (parsedFilters === null) {
			if (filtersParam === null) {
				setDynamicFilters([]);
			}
			return;
		}

		const serializedParsedFilters =
			parsedFilters.length > 0
				? serializeDashboardFilters(parsedFilters)
				: null;
		if (serializedParsedFilters === serializedDynamicFilters) {
			return;
		}

		setDynamicFilters(parsedFilters);
	}, [filtersParam, serializedDynamicFilters, setDynamicFilters]);

	useEffect(() => {
		if (serializedDynamicFilters === filtersParam) {
			return;
		}
		setFiltersParam(serializedDynamicFilters);
	}, [filtersParam, serializedDynamicFilters, setFiltersParam]);

	const isDemoRoute = pathname?.startsWith("/demo/");
	const hideToolbar = shouldHideAnalyticsToolbar(pathname, isEmbed);

	const {
		data: websiteData,
		isLoading: isWebsiteLoading,
		isError: isWebsiteError,
		error: websiteError,
	} = useWebsite(websiteId);

	const { isTrackingSetup, isTrackingSetupLoading, trackingIssue } =
		useTrackingSetup(websiteId);

	const isToolbarLoading =
		isWebsiteLoading ||
		(!isDemoRoute && (isTrackingSetupLoading || isTrackingSetup === null));

	const isToolbarDisabled =
		!isDemoRoute && (!isTrackingSetup || isToolbarLoading);

	const showTrackingSetup =
		!(isDemoRoute || isTrackingSetupLoading) &&
		websiteData &&
		isTrackingSetup === false;
	const showTrackingIssue =
		!(isDemoRoute || isTrackingSetupLoading) && trackingIssue;

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["websites", id] }),
				queryClient.invalidateQueries({
					queryKey: ["websites", "isTrackingSetup", id],
				}),
				queryClient.invalidateQueries({
					queryKey: dynamicQueryKeys.byWebsite(websiteId),
				}),
				queryClient.invalidateQueries({
					queryKey: batchDynamicQueryKeys.byWebsite(websiteId),
				}),
			]);
		} catch {
			toast.error("Failed to refresh data");
		}
		setIsRefreshing(false);
	};

	if (!id) {
		return <WebsiteErrorState error={{ data: { code: "NOT_FOUND" } }} />;
	}

	if (!isWebsiteLoading && isWebsiteError) {
		return (
			<WebsiteErrorState
				error={websiteError}
				isDemoRoute={isDemoRoute}
				websiteId={websiteId}
			/>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{!hideToolbar && (
				<>
					<TopBar.Title>
						<AnalyticsDateControls
							isDisabled={isToolbarDisabled}
							variant="topbar"
						/>
					</TopBar.Title>

					<TopBar.Actions>
						<AddFilterForm
							addFilter={addFilter}
							buttonText="Filter"
							disabled={isToolbarDisabled}
						/>
						<SavedFiltersToolbar />
						<LiveUserIndicator websiteId={websiteId} />
						<Button
							aria-label="Refresh data"
							disabled={isRefreshing || isToolbarDisabled}
							onClick={handleRefresh}
							size="sm"
							variant="secondary"
						>
							<ArrowClockwiseIcon
								aria-hidden
								className={cn(
									"size-4 shrink-0",
									isRefreshing || isToolbarLoading ? "animate-spin" : ""
								)}
							/>
						</Button>
					</TopBar.Actions>

					<AnalyticsToolbar
						className="md:hidden"
						isDisabled={isToolbarDisabled}
					/>

					{!isToolbarDisabled && <FiltersSection />}
				</>
			)}

			{hideToolbar ? (
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{children}
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
					{showTrackingIssue && trackingIssue ? (
						<div className="p-4 pb-0">
							<NoticeBanner
								description={trackingIssue.message}
								icon={<WarningCircleIcon className="text-amber-500" />}
								title="Tracking requests are being blocked"
							>
								<div className="flex flex-wrap items-center gap-2">
									{trackingIssue.type === "origin_not_authorized" ? (
										<Button asChild size="sm" variant="secondary">
											<Link href={`/websites/${websiteId}/settings/general`}>
												Update domain
											</Link>
										</Button>
									) : null}
									<Button asChild size="sm" variant="ghost">
										<Link href={`/websites/${websiteId}/settings/security`}>
											Security settings
										</Link>
									</Button>
								</div>
							</NoticeBanner>
						</div>
					) : null}
					{showTrackingSetup ? (
						<div className="p-4">
							<WebsiteTrackingSetupTab websiteId={websiteId} />
						</div>
					) : (
						children
					)}
				</div>
			)}
		</div>
	);
}
