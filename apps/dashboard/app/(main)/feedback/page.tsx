"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Skeleton } from "@/components/ds/skeleton";
import { TopBar } from "@/components/layout/top-bar";
import {
	LightningIcon,
	RobotIcon,
	StarIcon,
	TrendUpIcon,
} from "@/components/icons/nucleo";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { FeedbackList } from "./components/feedback-list";
import { RedeemDialog } from "./components/redeem-dialog";
import { SubmitFeedbackDialog } from "./components/submit-feedback-dialog";

const REWARD_TIERS = [
	{ creditsRequired: 50, rewardType: "events", rewardAmount: 1000 },
	{ creditsRequired: 100, rewardType: "events", rewardAmount: 2500 },
	{ creditsRequired: 200, rewardType: "events", rewardAmount: 5000 },
	{ creditsRequired: 500, rewardType: "events", rewardAmount: 15_000 },
	{ creditsRequired: 25, rewardType: "agent-credits", rewardAmount: 10 },
	{ creditsRequired: 75, rewardType: "agent-credits", rewardAmount: 35 },
	{ creditsRequired: 150, rewardType: "agent-credits", rewardAmount: 80 },
	{ creditsRequired: 400, rewardType: "agent-credits", rewardAmount: 250 },
] as const;

type Tab = "feedback" | "rewards";

function BalanceBar({
	available,
	totalEarned,
	isLoading,
}: {
	available: number;
	isLoading: boolean;
	totalEarned: number;
}) {
	if (isLoading) {
		return (
			<div className="flex items-center gap-4 rounded bg-secondary px-4 py-3">
				<Skeleton className="h-4 w-32 rounded" />
				<Skeleton className="h-3 w-20 rounded" />
			</div>
		);
	}

	return (
		<div className="flex items-center gap-4 rounded bg-secondary px-4 py-3">
			<div className="flex items-center gap-2">
				<StarIcon className="size-4 shrink-0 text-foreground" />
				<span className="font-semibold text-foreground text-sm tabular-nums">
					{available.toLocaleString()} credits
				</span>
			</div>
			<span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
				<TrendUpIcon className="size-3.5 shrink-0 text-success" />
				{totalEarned.toLocaleString()} earned
			</span>
		</div>
	);
}

function RewardsGrid({
	available,
	onRedeem,
	redeemingTier,
}: {
	available: number;
	onRedeem: (index: number) => void;
	redeemingTier: number | null;
}) {
	const eventTiers = REWARD_TIERS.map((t, i) => ({ ...t, index: i })).filter(
		(t) => t.rewardType === "events"
	);
	const agentTiers = REWARD_TIERS.map((t, i) => ({ ...t, index: i })).filter(
		(t) => t.rewardType === "agent-credits"
	);

	return (
		<div className="space-y-6">
			<div>
				<div className="mb-3 flex items-center gap-2">
					<LightningIcon className="size-4 shrink-0 text-amber-500" />
					<h3 className="font-semibold text-sm">Event Balance</h3>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					{eventTiers.map((tier) => {
						const canAfford = available >= tier.creditsRequired;
						return (
							<Card
								className={cn(
									"flex flex-col justify-between p-4",
									!canAfford && "opacity-40"
								)}
								key={tier.index}
							>
								<div>
									<p className="font-semibold text-2xl tabular-nums">
										{tier.rewardAmount.toLocaleString()}
									</p>
									<p className="text-muted-foreground text-xs">events</p>
								</div>
								<Button
									className="mt-4 w-full"
									disabled={!canAfford || redeemingTier === tier.index}
									loading={redeemingTier === tier.index}
									onClick={() => onRedeem(tier.index)}
									size="sm"
									variant={canAfford ? "primary" : "secondary"}
								>
									{canAfford
										? `Redeem for ${tier.creditsRequired} credits`
										: `Need ${tier.creditsRequired - available} more`}
								</Button>
							</Card>
						);
					})}
				</div>
			</div>

			<div>
				<div className="mb-3 flex items-center gap-2">
					<RobotIcon className="size-4 shrink-0 text-violet-500" />
					<h3 className="font-semibold text-sm">Agent Credits</h3>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					{agentTiers.map((tier) => {
						const canAfford = available >= tier.creditsRequired;
						return (
							<Card
								className={cn(
									"flex flex-col justify-between p-4",
									!canAfford && "opacity-40"
								)}
								key={tier.index}
							>
								<div>
									<p className="font-semibold text-2xl tabular-nums">
										{tier.rewardAmount.toLocaleString()}
									</p>
									<p className="text-muted-foreground text-xs">agent credits</p>
								</div>
								<Button
									className="mt-4 w-full"
									disabled={!canAfford || redeemingTier === tier.index}
									loading={redeemingTier === tier.index}
									onClick={() => onRedeem(tier.index)}
									size="sm"
									variant={canAfford ? "primary" : "secondary"}
								>
									{canAfford
										? `Redeem for ${tier.creditsRequired} credits`
										: `Need ${tier.creditsRequired - available} more`}
								</Button>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export default function FeedbackPage() {
	const { data: balance, isLoading: isBalanceLoading } = useQuery(
		orpc.feedback.getCreditsBalance.queryOptions()
	);

	const [tab, setTab] = useState<Tab>("feedback");
	const [redeemTier, setRedeemTier] = useState<number | null>(null);

	return (
		<div className="flex h-full flex-col">
			<TopBar.Title>
				<h1 className="font-semibold text-sm">Feedback & Credits</h1>
			</TopBar.Title>
			<TopBar.Actions>
				<SubmitFeedbackDialog />
			</TopBar.Actions>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-4 p-5">
					<BalanceBar
						available={balance?.available ?? 0}
						isLoading={isBalanceLoading}
						totalEarned={balance?.totalEarned ?? 0}
					/>

					<div className="flex gap-1 rounded bg-secondary p-1">
						<button
							className={cn(
								"flex-1 rounded px-4 py-2 font-semibold text-sm",
								tab === "feedback"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							)}
							onClick={() => setTab("feedback")}
							type="button"
						>
							My Feedback
						</button>
						<button
							className={cn(
								"flex-1 rounded px-4 py-2 font-semibold text-sm",
								tab === "rewards"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							)}
							onClick={() => setTab("rewards")}
							type="button"
						>
							Redeem Rewards
						</button>
					</div>

					{tab === "feedback" && <FeedbackList />}

					{tab === "rewards" && (
						<RewardsGrid
							available={balance?.available ?? 0}
							onRedeem={setRedeemTier}
							redeemingTier={redeemTier}
						/>
					)}
				</div>
			</div>

			{redeemTier !== null && (
				<RedeemDialog
					creditsRequired={REWARD_TIERS[redeemTier].creditsRequired}
					onOpenChangeAction={(open) => {
						if (!open) setRedeemTier(null);
					}}
					open
					rewardAmount={REWARD_TIERS[redeemTier].rewardAmount}
					rewardType={REWARD_TIERS[redeemTier].rewardType}
					tierIndex={redeemTier}
				/>
			)}
		</div>
	);
}
