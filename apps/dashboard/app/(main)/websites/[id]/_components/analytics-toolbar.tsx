"use client";

import { useCallback, useMemo } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { useHotkeys } from "react-hotkeys-hook";
import { DateRangePicker } from "@/components/date-range-picker";
import { useDateFilters } from "@/hooks/use-date-filters";
import { cn } from "@/lib/utils";
import { FiltersSection } from "./filters/filters-section";
import { Button, SegmentedControl, dayjs } from "@databuddy/ui";

const MAX_HOURLY_DAYS = 7;

interface QuickRange {
	days?: number;
	fullLabel: string;
	hours?: number;
	label: string;
}

const QUICK_RANGES: QuickRange[] = [
	{ label: "24h", fullLabel: "Last 24 hours", hours: 24 },
	{ label: "7d", fullLabel: "Last 7 days", days: 7 },
	{ label: "30d", fullLabel: "Last 30 days", days: 30 },
	{ label: "90d", fullLabel: "Last 90 days", days: 90 },
	{ label: "180d", fullLabel: "Last 180 days", days: 180 },
	{ label: "365d", fullLabel: "Last 365 days", days: 365 },
];

const GRANULARITY_OPTIONS = [
	{ label: "Daily", value: "daily" as const },
	{ label: "Hourly", value: "hourly" as const },
];

const getStartDateForRange = (range: QuickRange) => {
	const now = new Date();
	return range.hours
		? dayjs(now).subtract(range.hours, "hour").toDate()
		: dayjs(now)
				.subtract(range.days ?? 7, "day")
				.toDate();
};

interface AnalyticsToolbarProps {
	isDisabled?: boolean;
}

export function AnalyticsToolbar({
	isDisabled = false,
}: AnalyticsToolbarProps) {
	const {
		currentDateRange,
		currentGranularity,
		setCurrentGranularityAtomState,
		setDateRangeAction,
	} = useDateFilters();

	const dateRangeDays = useMemo(
		() =>
			dayjs(currentDateRange.endDate).diff(currentDateRange.startDate, "day"),
		[currentDateRange]
	);

	const isHourlyDisabled = dateRangeDays > MAX_HOURLY_DAYS;

	const selectedRange: DayPickerRange | undefined = useMemo(
		() => ({
			from: currentDateRange.startDate,
			to: currentDateRange.endDate,
		}),
		[currentDateRange]
	);

	const handleQuickRangeSelect = useCallback(
		(range: QuickRange) => {
			const start = getStartDateForRange(range);
			setDateRangeAction({ startDate: start, endDate: new Date() });
		},
		[setDateRangeAction]
	);

	const isQuickRangeActive = useCallback(
		(range: QuickRange) => {
			if (!(selectedRange?.from && selectedRange?.to)) {
				return false;
			}
			const now = new Date();
			const start = getStartDateForRange(range);
			return (
				dayjs(selectedRange.from).isSame(start, "day") &&
				dayjs(selectedRange.to).isSame(now, "day")
			);
		},
		[selectedRange]
	);

	useHotkeys(
		["1", "2", "3", "4", "5", "6"],
		(e) => {
			if (isDisabled) {
				return;
			}
			const index = Number.parseInt(e.key, 10) - 1;
			if (index >= 0 && index < QUICK_RANGES.length) {
				e.preventDefault();
				handleQuickRangeSelect(QUICK_RANGES[index]);
			}
		},
		{ preventDefault: true, enabled: !isDisabled },
		[isDisabled, handleQuickRangeSelect]
	);

	return (
		<div className="flex shrink-0 flex-col border-b">
			<div className="flex items-center gap-2 px-3 py-2">
				<SegmentedControl
					disabled={isDisabled || isHourlyDisabled}
					onChange={(v) => setCurrentGranularityAtomState(v)}
					options={GRANULARITY_OPTIONS}
					size="sm"
					value={currentGranularity}
				/>

				<div className="flex items-center gap-0.5">
					{QUICK_RANGES.map((range) => {
						const isActive = isQuickRangeActive(range);
						return (
							<Button
								className={cn(
									"h-6 px-2 text-[11px]",
									isActive && "bg-accent text-accent-foreground hover:bg-accent"
								)}
								disabled={isDisabled}
								key={range.label}
								onClick={() => handleQuickRangeSelect(range)}
								size="sm"
								title={range.fullLabel}
								variant={isActive ? "secondary" : "ghost"}
							>
								{range.label}
							</Button>
						);
					})}
				</div>

				<DateRangePicker
					className="w-auto"
					disabled={isDisabled}
					maxDate={new Date()}
					minDate={new Date(2020, 0, 1)}
					onChange={(range) => {
						if (range?.from && range?.to) {
							setDateRangeAction({
								startDate: range.from,
								endDate: range.to,
							});
						}
					}}
					value={selectedRange}
				/>
			</div>

			{!isDisabled && <FiltersSection />}
		</div>
	);
}
