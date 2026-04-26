"use client";

import Link from "next/link";
import { Badge, PercentageBadge } from "@/components/ds/badge";
import { Card } from "@/components/ds/card";
import { Text } from "@/components/ds/text";
import { TableEmptyState } from "@/components/table/table-empty-state";
import { Skeleton } from "@databuddy/ui";
import { chartSeriesColorAtIndex } from "@/lib/chart-presentation";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CustomEventItem } from "./types";
import { ArrowRightIcon, LightningIcon } from "@databuddy/ui/icons";

interface EventsListProps {
	eventColorMap?: Map<string, string>;
	events: CustomEventItem[];
	getEventHref?: (eventName: string) => string;
	isFetching?: boolean;
	isLoading?: boolean;
}

export function EventsList({
	events,
	eventColorMap,
	getEventHref,
	isLoading,
	isFetching,
}: EventsListProps) {
	if (isLoading) {
		return <EventsListSkeleton />;
	}

	if (events.length === 0) {
		return (
			<Card>
				<Card.Header>
					<Card.Title>Events</Card.Title>
					<Card.Description>All tracked event types</Card.Description>
				</Card.Header>
				<Card.Content>
					<TableEmptyState
						description="Events will appear here once tracked."
						icon={<LightningIcon className="size-6 text-muted-foreground" />}
						title="No events"
					/>
				</Card.Content>
			</Card>
		);
	}

	const maxEvents = Math.max(...events.map((event) => event.total_events), 1);

	return (
		<Card>
			<Card.Header className="flex-row items-center justify-between gap-3">
				<div className="min-w-0">
					<Card.Title>Events</Card.Title>
					<Card.Description>All tracked event types</Card.Description>
				</div>
				<div className="flex items-center gap-2">
					<Badge size="sm" variant="muted">
						{events.length} type{events.length === 1 ? "" : "s"}
					</Badge>
					{isFetching && !isLoading && (
						<span className="text-muted-foreground text-xs">Updating...</span>
					)}
				</div>
			</Card.Header>
			<div className="divide-y divide-border/60">
				<div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-muted-foreground text-xs">
					<span>Event Name</span>
					<span className="w-20 text-right">Events</span>
					<span className="w-20 text-right">Users</span>
					<span className="w-16 text-right">Share</span>
				</div>
				{events.map((event, index) => {
					const barWidth = (event.total_events / maxEvents) * 100;
					const color =
						eventColorMap?.get(event.name) ?? chartSeriesColorAtIndex(index);
					const href = getEventHref?.(event.name);
					const rowClassName = cn(
						"group relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-accent/50",
						href && "cursor-pointer"
					);
					const rowContent = (
						<>
							<div
								className="absolute inset-y-0 left-0 transition-all"
								style={{
									backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
									width: `${barWidth}%`,
								}}
							/>
							<div className="relative z-10 flex min-w-0 items-center gap-2.5">
								<div
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: color }}
								/>
								<Text className="truncate" variant="label">
									{event.name}
								</Text>
								{href && (
									<ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								)}
							</div>
							<span className="relative z-10 w-20 text-right font-medium text-foreground text-sm tabular-nums">
								{formatNumber(event.total_events)}
							</span>
							<span className="relative z-10 w-20 text-right text-muted-foreground text-sm tabular-nums">
								{formatNumber(event.unique_users)}
							</span>
							<span className="relative z-10 flex w-16 justify-end">
								<PercentageBadge percentage={event.percentage} />
							</span>
						</>
					);

					return href ? (
						<Link className={rowClassName} href={href} key={event.name}>
							{rowContent}
						</Link>
					) : (
						<div className={rowClassName} key={event.name}>
							{rowContent}
						</div>
					);
				})}
			</div>
		</Card>
	);
}

function EventsListSkeleton() {
	return (
		<Card>
			<Card.Header>
				<Skeleton className="h-5 w-16" />
				<Skeleton className="h-4 w-36" />
			</Card.Header>
			<div className="divide-y divide-border/60">
				{Array.from({ length: 5 }).map((_, index) => (
					<div
						className="flex items-center justify-between px-4 py-2.5"
						key={`skeleton-${index}`}
					>
						<div className="flex items-center gap-2.5">
							<Skeleton className="size-2 rounded-full" />
							<Skeleton
								className="h-4 rounded"
								style={{ width: `${120 - index * 15}px` }}
							/>
						</div>
						<div className="flex items-center gap-4">
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-5 w-12 rounded-full" />
						</div>
					</div>
				))}
			</div>
		</Card>
	);
}
