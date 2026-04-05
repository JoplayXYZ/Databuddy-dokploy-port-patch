"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { RobotIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/app/(main)/websites/_components/page-header";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLLMPageContext } from "./llm-page-context";

export function LLMPageHeader() {
	const {
		setSelectedWebsiteId,
		selectedWebsite,
		websites,
		isLoadingWebsites,
		refresh,
		isFetching,
		hasQueryId,
	} = useLLMPageContext();

	return (
		<PageHeader
			badgeContent="Alpha"
			badgeVariant="amber"
			description="Monitor AI model usage, costs, and performance"
			icon={<RobotIcon weight="duotone" />}
			right={
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className="min-w-[140px] justify-between"
								disabled={isLoadingWebsites}
								variant="outline"
							>
								{isLoadingWebsites ? (
									<Skeleton className="h-4 w-20" />
								) : selectedWebsite ? (
									<span className="truncate">{selectedWebsite.name}</span>
								) : (
									<span>All Websites</span>
								)}
								<CaretDownIcon className="ml-2 size-4" weight="fill" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							<DropdownMenuItem onClick={() => setSelectedWebsiteId(null)}>
								All Websites
							</DropdownMenuItem>
							{websites.map((website) => (
								<DropdownMenuItem
									key={website.id}
									onClick={() => setSelectedWebsiteId(website.id)}
								>
									{website.name || website.domain}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						disabled={isFetching || !hasQueryId}
						onClick={refresh}
						size="icon"
						variant="outline"
					>
						<ArrowClockwiseIcon
							className={isFetching ? "animate-spin" : ""}
							size={16}
						/>
					</Button>
				</div>
			}
			title="LLM Analytics"
		/>
	);
}
