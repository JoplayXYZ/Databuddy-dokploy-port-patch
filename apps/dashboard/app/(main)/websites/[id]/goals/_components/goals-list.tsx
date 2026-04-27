"use client";

import { List } from "@/components/ui/composables/list";
import type { Goal } from "@/hooks/use-goals";
import { GoalItem } from "./goal-item";
import { TargetIcon } from "@databuddy/ui/icons";
import { EmptyState } from "@databuddy/ui";

type GoalAnalyticsRecord = Record<
	string,
	| {
			total_users_entered: number;
			total_users_completed: number;
			overall_conversion_rate: number;
	  }
	| { error: string }
>;

interface GoalsListProps {
	analyticsLoading?: boolean;
	goalAnalytics?: GoalAnalyticsRecord;
	goals: Goal[];
	isLoading: boolean;
	onCreateGoal: () => void;
	onDeleteGoal: (goalId: string) => void;
	onEditGoal: (goal: Goal) => void;
}

const EMPTY_GOAL_ANALYTICS: GoalAnalyticsRecord = {};

export function GoalsList({
	goals,
	isLoading,
	onEditGoal,
	onDeleteGoal,
	onCreateGoal,
	goalAnalytics = EMPTY_GOAL_ANALYTICS,
	analyticsLoading = false,
}: GoalsListProps) {
	if (isLoading) {
		return null;
	}

	if (goals.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-16">
				<EmptyState
					action={{
						label: "Create a goal",
						onClick: onCreateGoal,
					}}
					description="Track conversions like signups, purchases, or button clicks."
					icon={<TargetIcon weight="duotone" />}
					title="No goals yet"
					variant="minimal"
				/>
			</div>
		);
	}

	return (
		<List className="rounded bg-card">
			{goals.map((goal) => {
				const analytics = goalAnalytics[goal.id];
				const validAnalytics =
					analytics && !("error" in analytics) ? analytics : null;

				return (
					<GoalItem
						analytics={validAnalytics}
						goal={goal}
						isLoadingAnalytics={analyticsLoading}
						key={goal.id}
						onDelete={onDeleteGoal}
						onEdit={onEditGoal}
					/>
				);
			})}
		</List>
	);
}
