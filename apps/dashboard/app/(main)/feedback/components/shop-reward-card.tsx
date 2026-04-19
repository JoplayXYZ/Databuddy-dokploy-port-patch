"use client";

import { LightningIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ds/button";
import { Text } from "@/components/ds/text";
import { cn } from "@/lib/utils";

interface ShopRewardCardProps {
	availableCredits: number;
	creditsRequired: number;
	isRedeeming: boolean;
	onRedeemAction: () => void;
	rewardAmount: number;
	rewardType: string;
}

export function ShopRewardCard({
	creditsRequired,
	rewardAmount,
	rewardType,
	availableCredits,
	onRedeemAction,
	isRedeeming,
}: ShopRewardCardProps) {
	const canAfford = availableCredits >= creditsRequired;
	const rate = Math.round(rewardAmount / creditsRequired);

	return (
		<div
			className={cn(
				"flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-card p-4",
				!canAfford && "opacity-50"
			)}
		>
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
						<LightningIcon
							className="size-4 text-foreground"
							weight="duotone"
						/>
					</div>
					<Text className="tabular-nums" tone="muted" variant="caption">
						{rate} {rewardType}/credit
					</Text>
				</div>
				<div>
					<p className="font-semibold text-lg tabular-nums">
						{rewardAmount.toLocaleString()}
					</p>
					<Text tone="muted" variant="caption">
						{rewardType}
					</Text>
				</div>
			</div>
			<Button
				className="w-full"
				disabled={!canAfford || isRedeeming}
				loading={isRedeeming}
				onClick={onRedeemAction}
				size="sm"
				variant={canAfford ? "primary" : "secondary"}
			>
				{canAfford
					? `${creditsRequired} credits`
					: `Need ${creditsRequired - availableCredits} more`}
			</Button>
		</div>
	);
}
