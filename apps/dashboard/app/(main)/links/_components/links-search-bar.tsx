"use client";

import { FunnelIcon } from "@phosphor-icons/react/dist/ssr";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { SortAscendingIcon } from "@phosphor-icons/react/dist/ssr";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ds/button";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Input } from "@/components/ds/input";
import { cn } from "@/lib/utils";
import type { SortOption } from "./use-filtered-links";

const SORT_LABELS: Record<SortOption, string> = {
	newest: "Newest",
	oldest: "Oldest",
	"name-asc": "A → Z",
	"name-desc": "Z → A",
};

interface LinksSearchBarProps {
	onSearchQueryChangeAction: (query: string) => void;
	onSortByChangeAction: (sort: SortOption) => void;
	searchQuery: string;
	sortBy: SortOption;
}

export function LinksSearchBar({
	searchQuery,
	onSearchQueryChangeAction,
	sortBy,
	onSortByChangeAction,
}: LinksSearchBarProps) {
	const hasActiveFilters = searchQuery.trim() !== "" || sortBy !== "newest";

	return (
		<div className="flex w-full items-center gap-1.5">
			<div className="relative flex-1">
				<MagnifyingGlassIcon
					className="absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
					weight="bold"
				/>
				<Input
					className="h-7 border-transparent bg-transparent pr-7 pl-8 text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:border-border focus-visible:bg-background"
					onChange={(e) => onSearchQueryChangeAction(e.target.value)}
					placeholder="Search links…"
					showFocusIndicator={false}
					value={searchQuery}
				/>
				{searchQuery && (
					<button
						aria-label="Clear search"
						className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
						onClick={() => onSearchQueryChangeAction("")}
						type="button"
					>
						<XIcon className="size-3.5" />
					</button>
				)}
			</div>

			<DropdownMenu>
				<DropdownMenu.Trigger
					className={cn(
						"inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-(--duration-quick) ease-(--ease-smooth) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
						"bg-secondary text-foreground hover:bg-interactive-hover",
						"h-7 px-2.5 text-xs",
						"gap-1 border-transparent px-2 shadow-none",
						sortBy !== "newest" && "border-primary/30 text-primary"
					)}
				>
					<SortAscendingIcon size={14} weight="bold" />
					<span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" className="w-36">
					<DropdownMenu.Group>
						<DropdownMenu.GroupLabel>Sort by</DropdownMenu.GroupLabel>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.RadioGroup
						onValueChange={(value) => onSortByChangeAction(value as SortOption)}
						value={sortBy}
					>
						<DropdownMenu.RadioItem value="newest">
							Newest first
						</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="oldest">
							Oldest first
						</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="name-asc">
							Name (A-Z)
						</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="name-desc">
							Name (Z-A)
						</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu>

			{hasActiveFilters && (
				<Button
					className="h-7 gap-1 px-2 text-xs"
					onClick={() => {
						onSearchQueryChangeAction("");
						onSortByChangeAction("newest");
					}}
					size="sm"
					variant="ghost"
				>
					<FunnelIcon size={14} weight="duotone" />
					Clear
				</Button>
			)}
		</div>
	);
}
