"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [
	{ label: "7d", value: 7 },
	{ label: "30d", value: 30 },
	{ label: "90d", value: 90 },
] as const;

interface TimeRangeSelectorProps {
	currentDays: number;
}

export function TimeRangeSelector({ currentDays }: TimeRangeSelectorProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function handleSelectAction(value: number) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === 90) {
			params.delete("days");
		} else {
			params.set("days", String(value));
		}
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname);
	}

	return (
		<div className="flex items-center gap-1 rounded border bg-muted/50 p-0.5">
			{RANGES.map((range) => (
				<button
					className={cn(
						"rounded px-2.5 py-1 font-medium text-xs transition-colors",
						currentDays === range.value
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					)}
					key={range.value}
					onClick={() => handleSelectAction(range.value)}
					type="button"
				>
					{range.label}
				</button>
			))}
		</div>
	);
}
