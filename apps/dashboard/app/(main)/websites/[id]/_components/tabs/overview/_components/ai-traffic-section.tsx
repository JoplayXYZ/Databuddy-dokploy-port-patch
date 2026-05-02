"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/formatters";
import { FaviconImage } from "@/components/analytics/favicon-image";
import { RobotIcon } from "@databuddy/ui/icons";

interface ReferrerRow {
	domain?: string;
	name: string;
	pageviews: number;
	referrer_type?: string;
	visitors: number;
}

interface AITrafficSectionProps {
	isLoading: boolean;
	referrers: ReferrerRow[];
}

export function AITrafficSection({
	referrers,
	isLoading,
}: AITrafficSectionProps) {
	const aiReferrers = useMemo(
		() =>
			referrers
				.filter((r) => r.referrer_type === "ai")
				.sort((a, b) => b.visitors - a.visitors),
		[referrers]
	);

	const totalVisitors = useMemo(
		() => aiReferrers.reduce((sum, r) => sum + r.visitors, 0),
		[aiReferrers]
	);

	if (isLoading || aiReferrers.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-3 rounded-xl bg-secondary p-1.5">
			<div className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2">
				<div className="flex size-7 items-center justify-center rounded bg-accent">
					<RobotIcon className="size-4 text-muted-foreground" />
				</div>
				<div>
					<p className="font-semibold text-base tabular-nums leading-tight">
						{formatNumber(totalVisitors)}
					</p>
					<p className="text-muted-foreground text-xs">AI referrals</p>
				</div>
			</div>

			<div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto px-2">
				{aiReferrers.map((r) => (
					<div
						className="flex shrink-0 items-center gap-1.5"
						key={r.name}
					>
						{r.domain ? (
							<FaviconImage
								altText={r.name}
								className="shrink-0 rounded-sm"
								domain={r.domain}
								size={14}
							/>
						) : null}
						<span className="text-muted-foreground text-xs">{r.name}</span>
						<span className="font-semibold text-foreground text-xs tabular-nums">
							{formatNumber(r.visitors)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
