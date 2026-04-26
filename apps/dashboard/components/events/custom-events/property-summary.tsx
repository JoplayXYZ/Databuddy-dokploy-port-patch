"use client";

import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { Badge } from "@/components/ds/badge";
import { EmptyState } from "@/components/ds/empty-state";
import { Select } from "@/components/ds/select";
import { formatNumber } from "@/lib/formatters";
import { getPropertyTypeLabel } from "./classify-properties";
import { PropertyValueCard } from "./property-value-card";
import type { ClassifiedEvent, ClassifiedProperty } from "./types";
import {
	ArrowClockwiseIcon,
	ArrowRightIcon,
	ChartBarIcon,
	ListBulletsIcon,
} from "@databuddy/ui/icons";

interface PropertySummaryProps {
	events: ClassifiedEvent[];
	getEventHref?: (eventName: string) => string;
	isFetching?: boolean;
	isLoading?: boolean;
	onPropertyValueSelect?: (
		eventName: string,
		propertyKey: string,
		value: string
	) => void;
	selectionQueryKey?: string;
}

export function PropertySummary({
	events,
	getEventHref,
	isFetching,
	isLoading,
	onPropertyValueSelect,
	selectionQueryKey = "event",
}: PropertySummaryProps) {
	const [selectedEvent, setSelectedEvent] = useQueryState(
		selectionQueryKey,
		parseAsString.withDefault("")
	);

	const activeEvent = useMemo(() => {
		if (selectedEvent) {
			return events.find((event) => event.name === selectedEvent);
		}
		return events[0];
	}, [events, selectedEvent]);

	if (isLoading) {
		return <PropertySummarySkeleton />;
	}

	if (events.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-12">
				<EmptyState
					description="No aggregatable properties found"
					icon={<ChartBarIcon />}
					title="No properties"
					variant="minimal"
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<Select
					onValueChange={(value) => setSelectedEvent(String(value))}
					value={activeEvent?.name ?? ""}
				>
					<Select.Trigger className="w-[220px] [--control-h:--spacing(8)]" />
					<Select.Content>
						{events.map((event) => (
							<Select.Item key={event.name} value={event.name}>
								{event.name}
							</Select.Item>
						))}
					</Select.Content>
				</Select>

				{activeEvent && (
					<>
						<Badge size="sm" variant="muted">
							{activeEvent.summaryProperties.length} propert
							{activeEvent.summaryProperties.length === 1 ? "y" : "ies"}
						</Badge>
						<Badge size="sm" variant="muted">
							{formatNumber(activeEvent.total_events)} events
						</Badge>
						{isFetching && !isLoading && (
							<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<ArrowClockwiseIcon className="size-3 animate-spin" />
								<span>Updating...</span>
							</div>
						)}
						{getEventHref && (
							<Link
								className="ml-auto flex items-center gap-1 text-primary text-sm transition-colors hover:text-primary/80 hover:underline"
								href={getEventHref(activeEvent.name)}
							>
								View details
								<ArrowRightIcon className="size-3.5" />
							</Link>
						)}
					</>
				)}
			</div>

			{activeEvent && activeEvent.summaryProperties.length > 0 && (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{activeEvent.summaryProperties.map((property) => (
						<PropertyCard
							eventName={activeEvent.name}
							key={property.key}
							onPropertyValueSelect={onPropertyValueSelect}
							property={property}
						/>
					))}
				</div>
			)}

			{activeEvent && activeEvent.summaryProperties.length === 0 && (
				<div className="flex flex-1 items-center justify-center py-12">
					<EmptyState
						description="This event has no aggregatable properties. Check the Stream tab for individual event details."
						icon={<ListBulletsIcon />}
						title="No aggregatable properties"
						variant="minimal"
					/>
				</div>
			)}
		</div>
	);
}

interface PropertyCardProps {
	eventName: string;
	onPropertyValueSelect?: (
		eventName: string,
		propertyKey: string,
		value: string
	) => void;
	property: ClassifiedProperty;
}

function PropertyCard({
	eventName,
	property,
	onPropertyValueSelect,
}: PropertyCardProps) {
	return (
		<PropertyValueCard
			onValueSelect={
				onPropertyValueSelect
					? (value) => onPropertyValueSelect(eventName, property.key, value)
					: undefined
			}
			title={property.key}
			typeLabel={getPropertyTypeLabel(property.classification)}
			uniqueCount={property.classification.cardinality}
			values={property.values}
		/>
	);
}

function PropertySummarySkeleton() {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<div className="h-8 w-[220px] animate-pulse rounded-md bg-muted" />
				<div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{[1, 2, 3].map((item) => (
					<div
						className="overflow-hidden rounded-lg border border-border/60 bg-background"
						key={item}
					>
						<div className="flex items-center justify-between border-border/60 border-b bg-muted/40 px-3 py-2">
							<div className="h-4 w-16 animate-pulse rounded bg-muted" />
							<div className="h-3 w-12 animate-pulse rounded bg-muted" />
						</div>
						<div className="space-y-1.5 p-1.5">
							{[1, 2, 3, 4].map((row) => (
								<div
									className="flex items-center justify-between rounded px-2 py-1.5"
									key={row}
								>
									<div className="h-4 w-20 animate-pulse rounded bg-muted" />
									<div className="h-3 w-12 animate-pulse rounded bg-muted" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
