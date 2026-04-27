"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "../utils";
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

export function UptimeHeatmapStrip({
	days,
	interactive,
	isActive,
	stripClassName,
	emptyLabel,
	getDateLabel,
	tooltipHasData,
}: UptimeHeatmapStripProps) {
	const [activeDay, setActiveDay] = useState<UptimeHeatmapDay | null>(null);
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const stripRef = useRef<HTMLDivElement>(null);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const target = (e.target as HTMLElement).closest<HTMLElement>(
				"[data-idx]"
			) ?? e.target as HTMLElement;
			const idx = target.dataset.idx;
			if (idx == null) return;
			const day = days[Number(idx)];
			if (!day) return;
			setActiveDay(day);
			const rect = stripRef.current?.getBoundingClientRect();
			if (rect) {
				const targetRect = target.getBoundingClientRect();
				setPos({
					x: targetRect.left + targetRect.width / 2 - rect.left,
					y: 0,
				});
			}
		},
		[days]
	);

	const handlePointerLeave = useCallback(() => setActiveDay(null), []);

	if (!interactive) {
		return (
			<div className={stripClassName}>
				{days.map((day) => (
					<div
						className={cn(
							"h-full flex-1 rounded-sm transition-colors",
							getUptimeHeatmapCellClass({
								uptimePercent: day.uptime,
								hasData: day.hasData,
								isActive,
								interactive: false,
							})
						)}
						key={day.dateStr}
					/>
				))}
			</div>
		);
	}

	const showData = activeDay
		? tooltipHasData
			? tooltipHasData(activeDay)
			: activeDay.hasData
		: false;

	return (
		<div className="relative" ref={stripRef}>
			<div
				className={stripClassName}
				onPointerLeave={handlePointerLeave}
				onPointerMove={handlePointerMove}
			>
				{days.map((day, i) => (
					<div
						className={cn(
							"h-full flex-1 rounded-sm transition-colors",
							getUptimeHeatmapCellClass({
								uptimePercent: day.uptime,
								hasData: day.hasData,
								isActive,
								interactive: true,
							})
						)}
						data-idx={i}
						key={day.dateStr}
					/>
				))}
			</div>

			{activeDay && (
				<div
					className="pointer-events-none absolute bottom-full z-50 mb-2"
					style={{
						left: pos.x,
						transform: "translateX(-50%)",
					}}
				>
					<div className="rounded-lg border border-border/60 bg-popover px-3 py-2.5 text-popover-foreground text-sm shadow-md">
						<UptimeHeatmapDayTooltipBody
							dateLabel={getDateLabel(activeDay.date)}
							downtimeSeconds={activeDay.downtimeSeconds}
							emptyLabel={emptyLabel}
							hasData={showData}
							uptimePercent={activeDay.uptime}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
