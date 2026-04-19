"use client";

import {
	CoinIcon,
	ShoppingCartIcon,
	TrendUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ds/card";
import { Skeleton } from "@/components/ds/skeleton";
import { Text } from "@/components/ds/text";

interface FeedbackCreditsCardProps {
	available: number;
	isLoading: boolean;
	totalEarned: number;
	totalSpent: number;
}

export function FeedbackCreditsCard({
	available,
	totalEarned,
	totalSpent,
	isLoading,
}: FeedbackCreditsCardProps) {
	if (isLoading) {
		return (
			<Card>
				<Card.Content>
					<div className="flex flex-wrap items-center gap-6">
						<div className="flex items-center gap-3">
							<Skeleton className="size-10 rounded-md" />
							<div className="space-y-1.5">
								<Skeleton className="h-3 w-14" />
								<Skeleton className="h-6 w-12" />
							</div>
						</div>
						<div className="hidden h-8 w-px bg-border/60 sm:block" />
						<div className="flex gap-6">
							<div className="space-y-1.5">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-4 w-10" />
							</div>
							<div className="space-y-1.5">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-4 w-10" />
							</div>
						</div>
					</div>
				</Card.Content>
			</Card>
		);
	}

	return (
		<Card>
			<Card.Content>
				<div className="flex flex-wrap items-center gap-6">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
							<CoinIcon className="size-5 text-foreground" weight="duotone" />
						</div>
						<div>
							<Text tone="muted" variant="caption">
								Available
							</Text>
							<p className="font-semibold text-xl tabular-nums">
								{available.toLocaleString()}
							</p>
						</div>
					</div>

					<div className="hidden h-8 w-px bg-border/60 sm:block" />

					<div className="flex gap-6">
						<div className="flex items-center gap-2">
							<TrendUpIcon
								className="size-3.5 text-muted-foreground"
								weight="duotone"
							/>
							<div>
								<Text tone="muted" variant="caption">
									Earned
								</Text>
								<Text className="tabular-nums" variant="label">
									{totalEarned.toLocaleString()}
								</Text>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<ShoppingCartIcon
								className="size-3.5 text-muted-foreground"
								weight="duotone"
							/>
							<div>
								<Text tone="muted" variant="caption">
									Spent
								</Text>
								<Text className="tabular-nums" variant="label">
									{totalSpent.toLocaleString()}
								</Text>
							</div>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card>
	);
}
