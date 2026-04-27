"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@databuddy/ui";
import { Text } from "@/components/ds/text";
import {
	BookOpenIcon,
	BugIcon,
	CaretDownIcon,
	ChatTextIcon,
	FlagIcon,
	GaugeIcon,
	LightbulbIcon,
	WrenchIcon,
} from "@databuddy/ui/icons";
import { dayjs } from "@databuddy/ui";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { FeedbackStatusBadge } from "./feedback-status-badge";

const CATEGORY_CONFIG: Record<
	string,
	{ label: string; icon: typeof BugIcon; color: string }
> = {
	bug_report: {
		label: "Bug Report",
		icon: BugIcon,
		color: "bg-destructive/10 text-destructive",
	},
	feature_request: {
		label: "Feature Request",
		icon: LightbulbIcon,
		color: "bg-warning/10 text-warning",
	},
	ux_improvement: {
		label: "UX Improvement",
		icon: WrenchIcon,
		color: "bg-sky-500/10 text-sky-500",
	},
	performance: {
		label: "Performance",
		icon: GaugeIcon,
		color: "bg-emerald-500/10 text-emerald-500",
	},
	documentation: {
		label: "Documentation",
		icon: BookOpenIcon,
		color: "bg-violet-500/10 text-violet-500",
	},
	other: {
		label: "Other",
		icon: FlagIcon,
		color: "bg-secondary text-muted-foreground",
	},
};

function FeedbackRowSkeleton() {
	return (
		<div className="flex items-start gap-3 px-5 py-3">
			<Skeleton className="mt-0.5 size-8 shrink-0 rounded" />
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-3.5 w-48 rounded" />
				<Skeleton className="h-3 w-full max-w-64 rounded" />
			</div>
			<Skeleton className="h-5 w-16 shrink-0 rounded-full" />
		</div>
	);
}

function FeedbackRow({
	item,
	isExpanded,
	onToggle,
}: {
	item: {
		id: string;
		title: string;
		description: string;
		category: string;
		status: "pending" | "approved" | "rejected";
		creditsAwarded: number;
		createdAt: string | Date;
	};
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
	const Icon = config.icon;

	return (
		<button
			className="w-full text-left transition-colors hover:bg-interactive-hover"
			onClick={onToggle}
			type="button"
		>
			<div className="flex items-start gap-3 px-5 py-3">
				<div
					className={cn(
						"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded",
						config.color
					)}
				>
					<Icon className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="truncate font-semibold text-foreground text-sm">
							{item.title}
						</p>
						<FeedbackStatusBadge status={item.status} />
					</div>
					<p
						className={cn(
							"mt-0.5 text-muted-foreground text-xs",
							!isExpanded && "line-clamp-1"
						)}
					>
						{item.description}
					</p>
					{isExpanded ? (
						<div className="mt-2 flex items-center gap-3">
							<Badge size="sm" variant="muted">
								{config.label}
							</Badge>
							{item.status === "approved" && item.creditsAwarded > 0 && (
								<Text className="text-success tabular-nums" variant="caption">
									+{item.creditsAwarded} credits
								</Text>
							)}
							<Text className="ml-auto" tone="muted" variant="caption">
								{dayjs(item.createdAt).format("MMM D, YYYY")}
							</Text>
						</div>
					) : (
						<p className="mt-1 text-[11px] text-muted-foreground/60">
							{config.label} · {dayjs(item.createdAt).fromNow()}
						</p>
					)}
				</div>
			</div>
		</button>
	);
}

export function FeedbackList() {
	const { data: items, isLoading } = useQuery(
		orpc.feedback.list.queryOptions({ input: {} })
	);

	const [categoryFilter, setCategoryFilter] = useState("all");
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const categories = useMemo(() => {
		if (!items) {
			return [];
		}
		return [...new Set(items.map((i) => i.category))].sort();
	}, [items]);

	const filtered = useMemo(() => {
		if (!items) {
			return [];
		}
		if (categoryFilter === "all") {
			return items;
		}
		return items.filter((item) => item.category === categoryFilter);
	}, [items, categoryFilter]);

	const showFilterBar =
		!isLoading && items && items.length > 0 && categories.length > 1;

	return (
		<Card>
			<Card.Header>
				<Card.Title>Your Feedback</Card.Title>
				<Card.Description>
					Submit feedback to earn credits — approved feedback gets rewarded
				</Card.Description>
			</Card.Header>

			{showFilterBar && (
				<div className="flex items-center justify-end gap-2 border-b px-5 py-2">
					{categoryFilter !== "all" && (
						<Text
							className="mr-auto tabular-nums"
							tone="muted"
							variant="caption"
						>
							{filtered.length} of {items.length}
						</Text>
					)}
					<DropdownMenu>
						<DropdownMenu.Trigger className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-secondary px-2.5 text-muted-foreground text-xs transition-colors hover:bg-interactive-hover hover:text-foreground">
							{categoryFilter === "all"
								? "All categories"
								: (CATEGORY_CONFIG[categoryFilter]?.label ?? categoryFilter)}
							<CaretDownIcon className="size-3" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end">
							<DropdownMenu.RadioGroup
								onValueChange={setCategoryFilter}
								value={categoryFilter}
							>
								<DropdownMenu.RadioItem value="all">
									All categories
								</DropdownMenu.RadioItem>
								{categories.map((cat) => (
									<DropdownMenu.RadioItem key={cat} value={cat}>
										{CATEGORY_CONFIG[cat]?.label ?? cat}
									</DropdownMenu.RadioItem>
								))}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Content>
					</DropdownMenu>
					{categoryFilter !== "all" && (
						<Button
							onClick={() => setCategoryFilter("all")}
							size="sm"
							variant="ghost"
						>
							Clear
						</Button>
					)}
				</div>
			)}

			<Card.Content className="p-0">
				{isLoading ? (
					<div className="divide-y divide-border/40">
						<FeedbackRowSkeleton />
						<FeedbackRowSkeleton />
						<FeedbackRowSkeleton />
					</div>
				) : !items || items.length === 0 ? (
					<div className="py-10">
						<EmptyState
							description="Your submitted feedback will appear here."
							icon={<ChatTextIcon />}
							title="No feedback yet"
						/>
					</div>
				) : filtered.length === 0 ? (
					<div className="py-10">
						<EmptyState
							action={
								<Button
									onClick={() => setCategoryFilter("all")}
									size="sm"
									variant="ghost"
								>
									Clear filters
								</Button>
							}
							icon={<ChatTextIcon />}
							title="No feedback matches filters"
						/>
					</div>
				) : (
					<div className="divide-y divide-border/40">
						{filtered.map((item) => (
							<FeedbackRow
								isExpanded={expandedId === item.id}
								item={item}
								key={item.id}
								onToggle={() =>
									setExpandedId(expandedId === item.id ? null : item.id)
								}
							/>
						))}
					</div>
				)}
			</Card.Content>
		</Card>
	);
}
