"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { formatDateOnly } from "@/lib/time";
import { buildUptimeHeatmapDays } from "@/lib/uptime/heatmap-days";
import { UptimeHeatmapStrip } from "@/lib/uptime/heatmap-strip";
import { LatencyChartChunkPlaceholder } from "@/lib/uptime/latency-chart-chunk-placeholder";

const LatencyChart = dynamic(
	() =>
		import("@/lib/uptime/latency-chart").then((m) => ({
			default: m.LatencyChart,
		})),
	{
		ssr: false,
		loading: () => <LatencyChartChunkPlaceholder />,
	}
);

interface DailyData {
	date: string;
	uptime_percentage: number;
	avg_response_time?: number;
	p95_response_time?: number;
}

interface MonitorRowInteractiveProps {
	id: string;
	dailyData: DailyData[];
	hasLatencyData: boolean;
}

const DAYS = 90;

export function MonitorRowInteractive({
	id,
	dailyData,
	hasLatencyData,
}: MonitorRowInteractiveProps) {
	const heatmapData = useMemo(
		() => buildUptimeHeatmapDays(dailyData, DAYS),
		[dailyData]
	);

	return (
		<>
			<div className="px-4 pb-4">
				<UptimeHeatmapStrip
					days={heatmapData}
					emptyLabel="No data recorded"
					getDateLabel={(d) => formatDateOnly(d)}
					interactive
					isActive
					stripClassName="flex h-8 w-full gap-px sm:gap-[2px]"
				/>
				<div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
					<span>{DAYS} days ago</span>
					<span>Today</span>
				</div>
			</div>

			{hasLatencyData ? (
				<LatencyChart data={dailyData} storageKey={`status-latency-${id}`} />
			) : null}
		</>
	);
}
