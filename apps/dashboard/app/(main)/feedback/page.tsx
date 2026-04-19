"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ds/card";
import { orpc } from "@/lib/orpc";
import { FeedbackCreditsCard } from "./components/feedback-credits-card";
import { FeedbackTable } from "./components/feedback-table";
import { RedeemDialog } from "./components/redeem-dialog";
import { ShopRewardCard } from "./components/shop-reward-card";

const REWARD_TIERS = [
	{ creditsRequired: 50, rewardType: "events", rewardAmount: 1000 },
	{ creditsRequired: 100, rewardType: "events", rewardAmount: 2500 },
	{ creditsRequired: 200, rewardType: "events", rewardAmount: 5000 },
	{ creditsRequired: 500, rewardType: "events", rewardAmount: 15_000 },
] as const;

export default function FeedbackPage() {
	const { data: balance, isLoading: isBalanceLoading } = useQuery(
		orpc.feedback.getCreditsBalance.queryOptions()
	);

	const [redeemTier, setRedeemTier] = useState<number | null>(null);

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="mx-auto max-w-2xl space-y-6 p-5">
				<FeedbackCreditsCard
					available={balance?.available ?? 0}
					isLoading={isBalanceLoading}
					totalEarned={balance?.totalEarned ?? 0}
					totalSpent={balance?.totalSpent ?? 0}
				/>

				<FeedbackTable />

				<Card>
					<Card.Header>
						<Card.Title>Credits Shop</Card.Title>
						<Card.Description>
							Exchange earned credits for extra event balance
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div className="grid gap-3 sm:grid-cols-2">
							{REWARD_TIERS.map((tier, index) => (
								<ShopRewardCard
									availableCredits={balance?.available ?? 0}
									creditsRequired={tier.creditsRequired}
									isRedeeming={redeemTier === index}
									key={tier.creditsRequired}
									onRedeemAction={() => setRedeemTier(index)}
									rewardAmount={tier.rewardAmount}
									rewardType={tier.rewardType}
								/>
							))}
						</div>
					</Card.Content>
				</Card>
			</div>

			{redeemTier !== null && (
				<RedeemDialog
					creditsRequired={REWARD_TIERS[redeemTier].creditsRequired}
					onOpenChangeAction={(open) => {
						if (!open) {
							setRedeemTier(null);
						}
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
