"use client";

import { Tooltip } from "@/components/ds/tooltip";
import { cn } from "@/lib/utils";
import { getUptimeHeatmapCellClass } from "./heatmap-cell-class";
import { UptimeHeatmapDayTooltipBody } from "./heatmap-day-tooltip";
import type { UptimeHeatmapDay } from "./heatmap-days";

export interface UptimeHeatmapStripProps {
	days: UptimeHeatmapDay[];
	emptyLabel: string;
	getDateLabel: (date: Date) => string;
	interactive: boolean;
	isActive: boolean;
	stripClassName: string;
	tooltipHasData?: (day: UptimeHeatmapDay) => boolean;
}

function HeatmapCell({
	day,
	isActive,
	interactive,
	ref,
	...rest
}: {
	day: UptimeHeatmapDay;
	isActive: boolean;
	interactive: boolean;
	ref?: React.Ref<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			ref={ref}
			{...rest}
			className={cn(
				"h-full flex-1 rounded-sm transition-colors",
				getUptimeHeatmapCellClass({
					uptimePercent: day.uptime,
					hasData: day.hasData,
					isActive,
					interactive,
				}),
				rest.className
			)}
		/>
	);
}

export function UptimeHeatmapStrip({
	days,
	interactive,
	isActive,
	stripClassName,
	emptyLabel,
	getDateLabel,
	tooltipHasData,
}: UptimeHeatmapStripProps) {
	if (!interactive) {
		return (
			<div className={stripClassName}>
				{days.map((day) => (
					<HeatmapCell
						day={day}
						interactive={false}
						isActive={isActive}
						key={day.dateStr}
					/>
				))}
			</div>
		);
	}

	return (
		<div className={stripClassName}>
			{days.map((day) => {
				const showDataInTooltip = tooltipHasData
					? tooltipHasData(day)
					: day.hasData;

				return (
					<Tooltip
						content={
							<UptimeHeatmapDayTooltipBody
								dateLabel={getDateLabel(day.date)}
								downtimeSeconds={day.downtimeSeconds}
								emptyLabel={emptyLabel}
								hasData={showDataInTooltip}
								successfulChecks={day.successfulChecks}
								totalChecks={day.totalChecks}
								uptimePercent={day.uptime}
							/>
						}
						key={day.dateStr}
					>
						<HeatmapCell day={day} interactive isActive={isActive} />
					</Tooltip>
				);
			})}
		</div>
	);
}
