"use client";

import { LightningIcon, RobotIcon, TrendUpIcon } from "@databuddy/ui/icons";
import { cn } from "@/lib/utils";
import { Button, Card, Skeleton } from "@databuddy/ui";

interface RewardTier {
	creditsRequired: number;
	rewardAmount: number;
	rewardType: string;
}

interface CreditsPanelProps {
	agentTiers: readonly RewardTier[];
	available: number;
	eventTiers: readonly RewardTier[];
	isLoading: boolean;
	onRedeemAction: (tierIndex: number) => void;
	redeemingTier: number | null;
	totalEarned: number;
	totalSpent: number;
}

const REWARD_LABELS: Record<string, string> = {
	events: "Events",
	"agent-credits": "Agent Credits",
};

const REWARD_ICONS: Record<string, typeof LightningIcon> = {
	events: LightningIcon,
	"agent-credits": RobotIcon,
};

function TierRow({
	tier,
	tierIndex,
	available,
	redeemingTier,
	onRedeem,
}: {
	available: number;
	onRedeem: (index: number) => void;
	redeemingTier: number | null;
	tier: RewardTier;
	tierIndex: number;
}) {
	const canAfford = available >= tier.creditsRequired;
	const Icon = REWARD_ICONS[tier.rewardType] ?? LightningIcon;

	return (
		<div
			className={cn(
				"flex items-center justify-between rounded bg-secondary px-3 py-2.5",
				!canAfford && "opacity-40"
			)}
		>
			<div className="flex items-center gap-2.5">
				<Icon className="size-4 shrink-0 text-foreground" />
				<p className="font-semibold text-sm tabular-nums">
					{tier.rewardAmount.toLocaleString()}{" "}
					{REWARD_LABELS[tier.rewardType] ?? tier.rewardType}
				</p>
			</div>
			<Button
				disabled={!canAfford || redeemingTier === tierIndex}
				loading={redeemingTier === tierIndex}
				onClick={() => onRedeem(tierIndex)}
				size="sm"
				variant={canAfford ? "primary" : "secondary"}
			>
				{tier.creditsRequired}
			</Button>
		</div>
	);
}

function BalanceSkeleton() {
	return (
		<div className="space-y-4 p-4">
			<div className="space-y-1">
				<Skeleton className="h-3 w-16 rounded" />
				<Skeleton className="h-8 w-20 rounded" />
			</div>
			<div className="flex gap-4">
				<Skeleton className="h-3 w-20 rounded" />
				<Skeleton className="h-3 w-20 rounded" />
			</div>
		</div>
	);
}

export function CreditsPanel({
	available,
	totalEarned,
	totalSpent,
	isLoading,
	eventTiers,
	agentTiers,
	onRedeemAction,
	redeemingTier,
}: CreditsPanelProps) {
	if (isLoading) {
		return (
			<Card>
				<BalanceSkeleton />
				<div className="space-y-2 border-t p-4">
					<Skeleton className="h-3 w-24 rounded" />
					{[1, 2, 3].map((n) => (
						<Skeleton className="h-14 w-full rounded" key={n} />
					))}
				</div>
			</Card>
		);
	}

	return (
		<Card>
			<div className="p-4">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Available Credits
				</p>
				<p className="mt-1 font-semibold text-3xl text-foreground tabular-nums">
					{available.toLocaleString()}
				</p>
				<div className="mt-3 flex items-center gap-4 text-muted-foreground text-xs">
					<span className="flex items-center gap-1 tabular-nums">
						<TrendUpIcon className="size-3.5 shrink-0 text-success" />
						{totalEarned.toLocaleString()} earned
					</span>
					<span className="tabular-nums">
						{totalSpent.toLocaleString()} spent
					</span>
				</div>
			</div>

			<div className="border-t p-4">
				<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Event Balance
				</p>
				<div className="space-y-2">
					{eventTiers.map((tier, i) => (
						<TierRow
							available={available}
							key={tier.creditsRequired}
							onRedeem={onRedeemAction}
							redeemingTier={redeemingTier}
							tier={tier}
							tierIndex={i}
						/>
					))}
				</div>
			</div>

			<div className="border-t p-4">
				<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Agent Credits
				</p>
				<div className="space-y-2">
					{agentTiers.map((tier, i) => (
						<TierRow
							available={available}
							key={tier.creditsRequired}
							onRedeem={onRedeemAction}
							redeemingTier={redeemingTier}
							tier={tier}
							tierIndex={eventTiers.length + i}
						/>
					))}
				</div>
			</div>
		</Card>
	);
}
