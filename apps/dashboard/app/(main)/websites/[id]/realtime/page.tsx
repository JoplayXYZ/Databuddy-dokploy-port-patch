"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useDynamicQuery } from "@/hooks/use-dynamic-query";
import { Skeleton } from "@databuddy/ui";
import { Silkscreen } from "next/font/google";

const pixel = Silkscreen({ weight: ["400", "700"], subsets: ["latin"] });

const RealtimeMap = dynamic(
	() =>
		import("./_components/realtime-map").then((mod) => ({
			default: mod.RealtimeMap,
		})),
	{
		loading: () => (
			<div className="flex h-full items-center justify-center">
				<Skeleton className="h-4 w-32 rounded" />
			</div>
		),
		ssr: false,
	}
);

export default function RealtimePage() {
	const { id } = useParams();
	const websiteId = id as string;

	const dateRange = useMemo(() => {
		const now = new Date();
		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
		return {
			start_date: fiveMinutesAgo.toISOString(),
			end_date: now.toISOString(),
		};
	}, []);

	const { data } = useDynamicQuery(
		websiteId,
		dateRange,
		{ id: "realtime-countries", parameters: ["realtime_countries"] },
		{ refetchInterval: 5000, staleTime: 0, gcTime: 10_000 }
	);

	const countries = ((data as any)?.realtime_countries || []) as Array<{
		country_code: string;
		country_name: string;
		visitors: number;
	}>;

	const totalVisitors = countries.reduce((sum, c) => sum + c.visitors, 0);

	return (
		<div className={`${pixel.className} p-4`}>
			<div className="overflow-hidden rounded-lg border border-border/60 bg-card">
				<div className="flex items-center justify-between border-border/40 border-b px-4 py-3">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="relative flex size-2">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500/60" />
								<span className="relative inline-flex size-2 rounded-full bg-green-500" />
							</span>
							<span className="text-muted-foreground text-xs uppercase tracking-widest">
								Live
							</span>
						</div>
						<span className="text-muted-foreground text-xs">·</span>
						<span className="text-muted-foreground text-xs">
							{countries.length} regions
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="font-bold text-2xl text-foreground tabular-nums">
							{totalVisitors}
						</span>
						<span className="text-muted-foreground text-xs">active</span>
					</div>
				</div>
				<div className="h-[600px]">
					<RealtimeMap countries={countries} />
				</div>
				{countries.length > 0 && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 border-border/40 border-t px-4 py-3">
						{countries.slice(0, 8).map((c) => (
							<span
								className="flex items-center gap-1.5 text-muted-foreground text-xs"
								key={c.country_code}
							>
								<span className="size-1.5 rounded-sm bg-success" />
								{c.country_name || c.country_code}
								<span className="text-foreground tabular-nums">
									{c.visitors}
								</span>
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
