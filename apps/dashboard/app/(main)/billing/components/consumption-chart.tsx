"use client";

import type {
	DailyUsageByTypeRow,
	UsageResponse,
} from "@databuddy/shared/types/billing";
import { CalendarIcon } from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import { METRIC_COLORS } from "@/components/charts/metrics-constants";
import { DateRangePicker } from "@/components/date-range-picker";
import { EmptyState } from "@/components/ds/empty-state";
import { Card } from "@/components/ds/card";
import { Chart } from "@/components/ui/composables/chart";
import { Skeleton } from "@/components/ds/skeleton";
import { Tabs } from "@/components/ds/tabs";
import {
	chartAxisTickDefault,
	chartCartesianGridDefault,
	chartPlotRegionClassName,
	chartRechartsInteractiveLegendLabelClassName,
	chartRechartsLegendIconSize,
	chartRechartsLegendInteractiveWrapperStyle,
	chartTooltipCustomSurfaceClassName,
	chartTooltipHeaderRowClassName,
} from "@/lib/chart-presentation";
import { cn } from "@/lib/utils";
import { calculateOverageCost, type OverageInfo } from "../utils/billing-utils";

type ViewMode = "daily" | "cumulative";

const {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} = Chart.Recharts;

const EVENT_TYPE_COLORS = {
	event: METRIC_COLORS.pageviews.primary,
	error: METRIC_COLORS.session_duration.primary,
	web_vitals: METRIC_COLORS.visitors.primary,
	custom_event: METRIC_COLORS.sessions.primary,
	outgoing_link: METRIC_COLORS.bounce_rate.primary,
} as const;

interface ConsumptionChartProps {
	isLoading: boolean;
	onDateRangeChange: (startDate: string, endDate: string) => void;
	overageInfo: OverageInfo | null;
	usageData?: UsageResponse;
}

export function ConsumptionChart({
	usageData,
	isLoading,
	onDateRangeChange,
	overageInfo,
}: ConsumptionChartProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("daily");
	const [hiddenTypes, setHiddenTypes] = useState<Record<string, boolean>>({});

	const chartData = useMemo(() => {
		if (!usageData?.dailyUsageByType) {
			return [];
		}

		const dailyDataMap = new Map<string, Record<string, number>>();

		const allDates: string[] = [
			...new Set(
				usageData.dailyUsageByType.map((row: DailyUsageByTypeRow) => row.date)
			),
		].sort();
		for (const date of allDates) {
			dailyDataMap.set(date, {
				event: 0,
				error: 0,
				web_vitals: 0,
				custom_event: 0,
				outgoing_link: 0,
			});
		}

		for (const row of usageData.dailyUsageByType) {
			const dayData = dailyDataMap.get(row.date);
			if (dayData) {
				dayData[row.event_category] = row.event_count;
			}
		}

		const runningTotals = Object.keys(EVENT_TYPE_COLORS).reduce(
			(acc, key) => {
				acc[key] = 0;
				return acc;
			},
			{} as Record<string, number>
		);

		const entries = Array.from(dailyDataMap.entries());

		return entries.map(([date, eventCounts]) => {
			const dayData: Record<string, string | number> = {
				date: new Date(date).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
				fullDate: date,
			};

			for (const eventType of Object.keys(EVENT_TYPE_COLORS)) {
				if (hiddenTypes[eventType]) {
					dayData[eventType] = 0;
					continue;
				}
				const actualAmount = eventCounts[eventType] || 0;

				if (viewMode === "cumulative") {
					runningTotals[eventType] += actualAmount;
					dayData[eventType] = runningTotals[eventType];
				} else {
					dayData[eventType] = actualAmount;
				}
			}

			return dayData;
		});
	}, [usageData?.dailyUsageByType, viewMode, hiddenTypes]);

	if (isLoading) {
		return (
			<Card>
				<Card.Header className="flex-row items-start justify-between gap-4">
					<div className="space-y-1">
						<Skeleton className="h-3.5 w-40" />
						<Skeleton className="h-3 w-56" />
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="h-7 w-40 rounded" />
						<Skeleton className="h-7 w-28 rounded" />
					</div>
				</Card.Header>
				<Card.Content>
					<Skeleton className="h-[280px] w-full rounded" />
				</Card.Content>
			</Card>
		);
	}

	if (!usageData || chartData.length === 0) {
		return (
			<Card>
				<Card.Header>
					<Card.Title>Consumption Breakdown</Card.Title>
					<Card.Description>Daily event volume by type</Card.Description>
				</Card.Header>
				<Card.Content className="py-8">
					<EmptyState
						icon={<CalendarIcon weight="duotone" />}
						title="No data available"
					/>
				</Card.Content>
			</Card>
		);
	}

	const maxValue = Math.max(
		...chartData.map((d) =>
			Object.keys(EVENT_TYPE_COLORS).reduce((sum, key) => {
				const v = d[key];
				return sum + (typeof v === "number" ? v : 0);
			}, 0)
		)
	);
	const yAxisMax = Math.ceil(maxValue * 1.1);

	return (
		<Card>
			<Card.Header className="flex-row flex-wrap items-start justify-between gap-4">
				<div>
					<Card.Title>Consumption Breakdown</Card.Title>
					<Card.Description>Daily event volume by type</Card.Description>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<DateRangePicker
						className="w-auto"
						maxDate={new Date()}
						minDate={new Date(2020, 0, 1)}
						onChange={(range) => {
							if (range?.from && range?.to) {
								onDateRangeChange(
									range.from.toISOString().split("T")[0],
									range.to.toISOString().split("T")[0]
								);
							}
						}}
						value={{
							from: new Date(usageData.dateRange.startDate),
							to: new Date(usageData.dateRange.endDate),
						}}
					/>
					<Tabs
						onValueChange={(v) => setViewMode(v as ViewMode)}
						value={viewMode}
					>
						<Tabs.List>
							<Tabs.Tab value="daily">Daily</Tabs.Tab>
							<Tabs.Tab value="cumulative">Cumulative</Tabs.Tab>
						</Tabs.List>
					</Tabs>
				</div>
			</Card.Header>
			<Card.Content className="p-0">
				<div
					className={cn(chartPlotRegionClassName, "bg-accent/30 p-4 sm:p-6")}
				>
					<div className="h-[280px]">
						<ResponsiveContainer height="100%" width="100%">
							<BarChart
								data={chartData}
								margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
								style={{ cursor: "default" }}
							>
								<defs>
									{Object.entries(EVENT_TYPE_COLORS).map(([key, color]) => (
										<linearGradient
											id={`gradient-${key}`}
											key={key}
											x1="0"
											x2="0"
											y1="0"
											y2="1"
										>
											<stop offset="0%" stopColor={color} stopOpacity={0.8} />
											<stop offset="100%" stopColor={color} stopOpacity={0.6} />
										</linearGradient>
									))}
								</defs>
								<CartesianGrid {...chartCartesianGridDefault} />
								<XAxis
									axisLine={{ stroke: "var(--border)", strokeOpacity: 0.5 }}
									dataKey="date"
									tick={{ ...chartAxisTickDefault, fontWeight: 500 }}
									tickLine={false}
								/>
								<YAxis
									axisLine={false}
									domain={[0, yAxisMax]}
									tick={{ ...chartAxisTickDefault, fontWeight: 500 }}
									tickFormatter={(value) => {
										if (value >= 1_000_000) {
											return `${(value / 1_000_000).toFixed(1)}M`;
										}
										if (value >= 1000) {
											return `${(value / 1000).toFixed(1)}k`;
										}
										return value.toString();
									}}
									tickLine={false}
									width={45}
								/>
								<Tooltip
									content={({ active, payload, label }) => {
										if (active && payload?.length) {
											return (
												<div className={chartTooltipCustomSurfaceClassName()}>
													<div className={chartTooltipHeaderRowClassName}>
														<p className="font-semibold text-foreground text-sm">
															{label}
														</p>
													</div>
													<div className="space-y-2">
														{payload
															.filter(
																(entry) =>
																	entry.value && (entry.value as number) > 0
															)
															.map((entry, index) => {
																const eventType =
																	entry.dataKey as keyof typeof EVENT_TYPE_COLORS;
																const color = EVENT_TYPE_COLORS[eventType];
																const eventCount = entry.value as number;
																const overageCost = usageData
																	? calculateOverageCost(
																			eventCount,
																			usageData.totalEvents,
																			overageInfo
																		)
																	: 0;

																return (
																	<div
																		className="flex items-center justify-between gap-3"
																		key={index}
																	>
																		<div className="flex items-center gap-2">
																			<div
																				className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
																				style={{ backgroundColor: color }}
																			/>
																			<span className="font-medium text-muted-foreground text-xs capitalize">
																				{entry.dataKey
																					?.toString()
																					.replace("_", " ")}
																			</span>
																		</div>
																		<div className="text-balance text-right">
																			<div className="font-semibold text-foreground text-sm tabular-nums">
																				{eventCount.toLocaleString()}
																			</div>
																			{overageCost > 0 && (
																				<div className="text-muted-foreground text-xs">
																					${overageCost.toFixed(2)}
																				</div>
																			)}
																		</div>
																	</div>
																);
															})}
													</div>
												</div>
											);
										}
										return null;
									}}
									cursor={Chart.tooltipCursorBar}
									wrapperStyle={{ outline: "none" }}
								/>
								<Legend
									align="center"
									formatter={(value) => {
										const key = String(value);
										const isHidden = hiddenTypes[key];
										return (
											<span
												className={cn(
													"inline-flex select-none items-center capitalize leading-none transition-all duration-200",
													chartRechartsInteractiveLegendLabelClassName(isHidden)
												)}
											>
												{key.replace("_", " ")}
											</span>
										);
									}}
									iconSize={chartRechartsLegendIconSize}
									iconType="circle"
									layout="horizontal"
									onClick={(payload) => {
										const anyPayload = payload as unknown as {
											dataKey?: string | number;
											value?: string | number;
										};
										const raw = anyPayload?.dataKey ?? anyPayload?.value;
										if (raw == null) {
											return;
										}
										const key = String(raw);
										setHiddenTypes((prev) => ({ ...prev, [key]: !prev[key] }));
									}}
									verticalAlign="bottom"
									wrapperStyle={chartRechartsLegendInteractiveWrapperStyle}
								/>
								{Object.keys(EVENT_TYPE_COLORS).map((eventType) => (
									<Bar
										dataKey={eventType}
										fill={`url(#gradient-${eventType})`}
										hide={!!hiddenTypes[eventType]}
										key={eventType}
										stackId="events"
										stroke={
											EVENT_TYPE_COLORS[
												eventType as keyof typeof EVENT_TYPE_COLORS
											]
										}
										strokeWidth={0.5}
										style={{
											filter: "none",
											transition: "none",
										}}
									/>
								))}
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>
			</Card.Content>
		</Card>
	);
}
