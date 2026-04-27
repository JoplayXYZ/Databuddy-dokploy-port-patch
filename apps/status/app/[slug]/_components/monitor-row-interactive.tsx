"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { formatDateOnly, localDayjs } from "@databuddy/ui";
import {
	buildUptimeHeatmapDays,
	UptimeHeatmapStrip,
	LatencyChartChunkPlaceholder,
} from "@databuddy/ui/uptime";

const LatencyChart = dynamic(
	() =>
		import("@databuddy/ui/uptime").then((m) => ({
			default: m.LatencyChart,
		})),
	{
		ssr: false,
		loading: () => <LatencyChartChunkPlaceholder />,
	}
);

interface MonitorRowInteractiveProps {
	dailyData: Array<{
		avg_response_time?: number;
		date: string;
		p95_response_time?: number;
		uptime_percentage?: number;
	}>;
	days: number;
	hasLatencyData: boolean;
	hasUptimeData?: boolean;
	id: string;
}

interface MonthMarker {
	label: string;
	offset: number;
}

function buildMonthMarkers(days: number): MonthMarker[] {
	const today = localDayjs().endOf("day");
	const markers: MonthMarker[] = [];
	let prevMonth = -1;

	for (let i = 0; i < days; i++) {
		const date = today.subtract(days - 1 - i, "day");
		const month = date.month();

		if (month !== prevMonth && i > 0) {
			markers.push({
				label: date.format("MMM"),
				offset: (i / days) * 100,
			});
		}
		prevMonth = month;
	}

	return markers;
}

export function MonitorRowInteractive({
	id,
	dailyData,
	days,
	hasLatencyData,
	hasUptimeData = true,
}: MonitorRowInteractiveProps) {
	const heatmapData = useMemo(
		() => buildUptimeHeatmapDays(dailyData, days),
		[dailyData, days]
	);

	const monthMarkers = useMemo(() => buildMonthMarkers(days), [days]);

	return (
		<>
			{hasUptimeData ? (
				<div>
					<UptimeHeatmapStrip
						days={heatmapData}
						emptyLabel="No data recorded"
						getDateLabel={(d) => formatDateOnly(d)}
						interactive
						isActive
						stripClassName="flex h-7 w-full gap-[1px] sm:gap-[2px]"
					/>
					<div className="relative mt-1.5 h-3.5 w-full">
						{monthMarkers.map((marker) => (
							<span
								className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
								key={`${marker.label}-${marker.offset}`}
								style={{ left: `${marker.offset}%` }}
							>
								{marker.label}
							</span>
						))}
					</div>
				</div>
			) : null}

			{hasLatencyData ? (
				<LatencyChart data={dailyData} storageKey={`status-latency-${id}`} />
			) : null}
		</>
	);
}
