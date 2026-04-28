"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useDynamicQuery } from "@/hooks/use-dynamic-query";
import { Card, Skeleton } from "@databuddy/ui";

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
		visitors: number;
	}>;

	return (
		<div className="p-4">
			<Card>
				<Card.Content className="h-[300px] p-0">
					<RealtimeMap countries={countries} />
				</Card.Content>
			</Card>
		</div>
	);
}
