"use client";

import { GATED_FEATURES } from "@databuddy/shared/types/features";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { Card } from "@/components/ds/card";
import { List } from "@/components/ui/composables/list";
import { DeleteDialog } from "@/components/ds/delete-dialog";
import { useAutocompleteData } from "@/hooks/use-autocomplete";
import { useDateFilters } from "@/hooks/use-date-filters";
import {
	type CreateGoalData,
	type Goal,
	useBulkGoalAnalytics,
	useGoals,
} from "@/hooks/use-goals";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ds/button";
import { EditGoalDialog } from "./_components/edit-goal-dialog";
import { GoalItemSkeleton } from "./_components/goal-item";
import { GoalsList } from "./_components/goals-list";
import { PlusIcon, TrendDownIcon } from "@databuddy/ui/icons";

function GoalsListSkeleton() {
	return (
		<List className="rounded bg-card">
			{[1, 2, 3].map((i) => (
				<GoalItemSkeleton key={i} />
			))}
		</List>
	);
}

export default function GoalsPage() {
	const { id } = useParams();
	const websiteId = id as string;
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
	const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

	const { dateRange } = useDateFilters();

	const {
		data: goals,
		isLoading: goalsLoading,
		error: goalsError,
		createGoal,
		updateGoal,
		deleteGoal,
		isCreating,
		isUpdating,
	} = useGoals(websiteId);

	const goalIds = useMemo(() => goals.map((goal) => goal.id), [goals]);

	const { data: goalAnalytics, isLoading: analyticsLoading } =
		useBulkGoalAnalytics(websiteId, goalIds, dateRange);

	const autocompleteQuery = useAutocompleteData(websiteId);

	const handleSaveGoal = async (
		data: Goal | Omit<CreateGoalData, "websiteId">
	) => {
		try {
			if ("id" in data && data.id) {
				await updateGoal({
					goalId: data.id,
					updates: {
						name: data.name,
						description: data.description || undefined,
						type: data.type,
						target: data.target,
						filters: data.filters,
						ignoreHistoricData:
							"ignoreHistoricData" in data
								? data.ignoreHistoricData
								: undefined,
					},
				});
			} else {
				await createGoal({
					name: data.name,
					description: data.description || undefined,
					type: data.type,
					target: data.target,
					filters: data.filters,
					ignoreHistoricData:
						"ignoreHistoricData" in data ? data.ignoreHistoricData : undefined,
					websiteId,
				} as CreateGoalData);
			}
			setIsDialogOpen(false);
			setEditingGoal(null);
		} catch (error) {
			console.error("Failed to save goal:", error);
		}
	};

	const handleDeleteGoal = async (goalId: string) => {
		try {
			await deleteGoal(goalId);
			setDeletingGoalId(null);
		} catch (error) {
			console.error("Failed to delete goal:", error);
		}
	};

	if (goalsError) {
		return (
			<div className="p-4">
				<Card className="border-destructive/20 bg-destructive/5">
					<Card.Content className="pt-6">
						<div className="flex items-center gap-2">
							<TrendDownIcon
								className="size-5 text-destructive"
								weight="duotone"
							/>
							<p className="font-medium text-destructive">
								Error loading goal data
							</p>
						</div>
						<p className="mt-2 text-destructive/80 text-sm">
							{goalsError.message}
						</p>
					</Card.Content>
				</Card>
			</div>
		);
	}

	return (
		<FeatureGate feature={GATED_FEATURES.GOALS}>
			<div className="relative flex h-full flex-col">
				<TopBar.Title>
					<h1 className="font-semibold text-sm">Goals</h1>
				</TopBar.Title>
				<TopBar.Actions>
					<Button
						onClick={() => {
							setEditingGoal(null);
							setIsDialogOpen(true);
						}}
						size="sm"
					>
						<PlusIcon className="size-4 shrink-0" />
						Create Goal
					</Button>
				</TopBar.Actions>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
					{goalsLoading ? (
						<GoalsListSkeleton />
					) : (
						<GoalsList
							analyticsLoading={analyticsLoading}
							goalAnalytics={goalAnalytics}
							goals={goals}
							isLoading={goalsLoading}
							onCreateGoal={() => {
								setEditingGoal(null);
								setIsDialogOpen(true);
							}}
							onDeleteGoal={(goalId) => setDeletingGoalId(goalId)}
							onEditGoal={(goal) => {
								setEditingGoal(goal);
								setIsDialogOpen(true);
							}}
						/>
					)}
				</div>

				{isDialogOpen && (
					<EditGoalDialog
						autocompleteData={autocompleteQuery.data}
						goal={editingGoal}
						isOpen={isDialogOpen}
						isSaving={isCreating || isUpdating}
						onClose={() => {
							setIsDialogOpen(false);
							setEditingGoal(null);
						}}
						onSave={handleSaveGoal}
					/>
				)}

				{deletingGoalId && (
					<DeleteDialog
						confirmLabel="Delete Goal"
						description="Are you sure you want to delete this goal? This action cannot be undone and will permanently remove all associated analytics data."
						isOpen={!!deletingGoalId}
						onClose={() => setDeletingGoalId(null)}
						onConfirm={() => {
							if (deletingGoalId) {
								return handleDeleteGoal(deletingGoalId);
							}
						}}
						title="Delete Goal"
					/>
				)}
			</div>
		</FeatureGate>
	);
}
