"use client";

import { Badge } from "@/components/ds/badge";
import { Text } from "@/components/ds/text";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { safePercentage } from "./events-utils";
import { FunnelIcon, TagIcon } from "@databuddy/ui/icons";

export interface PropertyValueCardValue {
	count: number;
	percentage: number;
	property_value: string;
}

interface PropertyValueCardProps {
	className?: string;
	maxVisibleValues?: number;
	onValueSelect?: (value: string) => void;
	title: string;
	typeLabel?: string;
	uniqueCount: number;
	values: PropertyValueCardValue[];
}

export function PropertyValueCard({
	className,
	maxVisibleValues,
	onValueSelect,
	title,
	typeLabel,
	uniqueCount,
	values,
}: PropertyValueCardProps) {
	const visibleValues = maxVisibleValues
		? values.slice(0, maxVisibleValues)
		: values;
	const maxCount = Math.max(...visibleValues.map((value) => value.count), 1);
	const hiddenCount = Math.max(0, values.length - visibleValues.length);
	const isInteractive = Boolean(onValueSelect);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border border-border/60 bg-background",
				className
			)}
		>
			<div className="flex min-h-10 items-center justify-between gap-3 border-border/60 border-b bg-muted/40 px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					{!typeLabel && (
						<TagIcon
							className="size-3.5 shrink-0 text-muted-foreground"
							weight="duotone"
						/>
					)}
					<Text className="truncate" variant="label">
						{title}
					</Text>
					{typeLabel && (
						<Badge size="sm" variant="muted">
							{typeLabel}
						</Badge>
					)}
				</div>
				<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
					{uniqueCount} unique
				</span>
			</div>

			<div className="max-h-[180px] overflow-y-auto p-1.5">
				{visibleValues.map((value, index) => {
					const displayValue = value.property_value;
					const percentage = safePercentage(value.percentage);
					const barWidth = (value.count / maxCount) * 100;

					const content = (
						<>
							<div
								className="absolute inset-y-0 left-0 rounded bg-primary/8 transition-all group-hover:bg-primary/12"
								style={{ width: `${barWidth}%` }}
							/>
							<div className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2">
								<span
									className="truncate text-foreground text-sm"
									title={displayValue}
								>
									{displayValue || "(empty)"}
								</span>
								<div className="flex shrink-0 items-center gap-2">
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatNumber(value.count)}
									</span>
									<span className="w-10 text-right text-muted-foreground/60 text-xs tabular-nums">
										{percentage.toFixed(0)}%
									</span>
									{isInteractive && (
										<FunnelIcon
											aria-hidden="true"
											className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
											weight="duotone"
										/>
									)}
								</div>
							</div>
						</>
					);

					const rowClassName = cn(
						"group relative flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors",
						isInteractive &&
							"hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					);

					return isInteractive ? (
						<button
							aria-label={`Filter by ${title}: ${displayValue || "empty"}`}
							className={rowClassName}
							key={`${displayValue}-${index}`}
							onClick={() => onValueSelect?.(displayValue)}
							type="button"
						>
							{content}
						</button>
					) : (
						<div className={rowClassName} key={`${displayValue}-${index}`}>
							{content}
						</div>
					);
				})}

				{hiddenCount > 0 && (
					<div className="mt-1 border-border/60 border-t pt-2 text-center text-muted-foreground/60 text-xs">
						+{hiddenCount} more value{hiddenCount === 1 ? "" : "s"}
					</div>
				)}
			</div>
		</div>
	);
}
