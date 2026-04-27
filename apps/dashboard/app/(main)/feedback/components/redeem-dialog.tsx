"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { ArrowDownIcon } from "@databuddy/ui/icons";
import { Button, Text } from "@databuddy/ui";
import { Dialog } from "@databuddy/ui/client";

interface RedeemDialogProps {
	creditsRequired: number;
	onOpenChangeAction: (open: boolean) => void;
	open: boolean;
	rewardAmount: number;
	rewardType: string;
	tierIndex: number;
}

export function RedeemDialog({
	open,
	onOpenChangeAction,
	tierIndex,
	creditsRequired,
	rewardAmount,
	rewardType,
}: RedeemDialogProps) {
	const queryClient = useQueryClient();

	const redeemMutation = useMutation({
		...orpc.feedback.redeemCredits.mutationOptions(),
		onSuccess: (result) => {
			toast.success(
				`Redeemed ${result.rewardAmount.toLocaleString()} ${result.rewardType}! ${result.remainingCredits} credits remaining.`
			);
			queryClient.invalidateQueries({
				queryKey: orpc.feedback.getCreditsBalance.queryOptions().queryKey,
			});
			onOpenChangeAction(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to redeem credits");
		},
	});

	return (
		<Dialog onOpenChange={onOpenChangeAction} open={open}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Confirm Redemption</Dialog.Title>
					<Dialog.Description>
						This will deduct credits from your balance and add{" "}
						{rewardType === "agent-credits" ? "agent credits" : "events"} to
						your account.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Body className="space-y-2">
					<div className="flex items-center justify-between rounded-md bg-secondary px-4 py-3">
						<Text tone="muted" variant="body">
							Credits spent
						</Text>
						<Text className="tabular-nums" variant="label">
							{creditsRequired}
						</Text>
					</div>
					<div className="flex justify-center">
						<ArrowDownIcon
							className="size-3.5 text-muted-foreground"
							weight="fill"
						/>
					</div>
					<div className="flex items-center justify-between rounded-md bg-secondary px-4 py-3">
						<Text tone="muted" variant="body">
							{rewardType === "agent-credits" ? "Agent credits" : "Events"}{" "}
							added
						</Text>
						<Text className="text-success tabular-nums" variant="label">
							+{rewardAmount.toLocaleString()} {rewardType}
						</Text>
					</div>
				</Dialog.Body>
				<Dialog.Footer>
					<Dialog.Close>
						<Button variant="secondary">Cancel</Button>
					</Dialog.Close>
					<Button
						disabled={redeemMutation.isPending}
						loading={redeemMutation.isPending}
						onClick={() => redeemMutation.mutate({ tierIndex })}
					>
						Confirm Redemption
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog>
	);
}
