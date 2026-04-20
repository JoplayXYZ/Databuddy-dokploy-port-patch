"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { LightningIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/app/(main)/websites/_components/page-header";
import { Button } from "@/components/ds/button";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Skeleton } from "@/components/ds/skeleton";
import { cn } from "@/lib/utils";
import { useEventsPageContext } from "./events-page-context";

function getDropdownLabel(
	websiteFilterMode: string,
	selectedWebsite: { name: string; domain: string } | undefined
) {
	if (websiteFilterMode === "no-website") {
		return "No Website";
	}
	if (websiteFilterMode === "all") {
		return "All Websites";
	}
	if (selectedWebsite) {
		return selectedWebsite.name || selectedWebsite.domain;
	}
	return "Unknown";
}

export function EventsPageHeader() {
	const {
		websiteFilterMode,
		setWebsiteFilterMode,
		selectedWebsite,
		websites,
		isLoadingWebsites,
		hasQueryId,
		query,
	} = useEventsPageContext();

	return (
		<PageHeader
			badgeContent="Alpha"
			badgeVariant="warning"
			description="Track and analyze custom events across all websites"
			icon={<LightningIcon weight="duotone" />}
			right={
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenu.Trigger
							className={cn(
								"inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
								"transition-all duration-(--duration-quick) ease-(--ease-smooth)",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
								"disabled:pointer-events-none disabled:opacity-50",
								"h-8 px-3 text-xs",
								"bg-secondary text-foreground hover:bg-interactive-hover",
								"min-w-[140px] justify-between"
							)}
							disabled={isLoadingWebsites}
						>
							{isLoadingWebsites ? (
								<Skeleton className="h-4 w-20" />
							) : (
								<span className="truncate">
									{getDropdownLabel(websiteFilterMode, selectedWebsite)}
								</span>
							)}
							<CaretDownIcon className="ml-2 size-4" weight="fill" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" className="w-[200px]">
							<DropdownMenu.Item onClick={() => setWebsiteFilterMode("all")}>
								All Websites
							</DropdownMenu.Item>
							<DropdownMenu.Item
								onClick={() => setWebsiteFilterMode("no-website")}
							>
								No Website
							</DropdownMenu.Item>
							{websites.length > 0 && <DropdownMenu.Separator />}
							{websites.map((website) => (
								<DropdownMenu.Item
									key={website.id}
									onClick={() => setWebsiteFilterMode(website.id)}
								>
									{website.name || website.domain}
								</DropdownMenu.Item>
							))}
						</DropdownMenu.Content>
					</DropdownMenu>
					<Button
						aria-label="Refresh events data"
						disabled={query.isFetching || !hasQueryId}
						onClick={() => query.refetch()}
						size="icon"
						variant="outline"
					>
						<ArrowClockwiseIcon
							className={query.isFetching ? "animate-spin" : ""}
							size={16}
						/>
					</Button>
				</div>
			}
			title="Custom Events"
		/>
	);
}
