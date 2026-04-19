"use client";

import {
	IconCheckFillDuo18,
	IconEyeFillDuo18,
	IconLoader2FillDuo18,
	IconMouse2FillDuo18,
	IconPencilFillDuo18,
	IconTargetFillDuo18,
	IconTrashFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { useParams } from "next/navigation";
import type {  useCallback, useState, FC, SVGProps } from "react";
import { toast } from "sonner";
import { EditGoalDialog } from "@/app/(main)/websites/[id]/goals/_components/edit-goal-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChat } from "@/contexts/chat-context";
import { type CreateGoalData, type Goal, useGoals } from "@/hooks/use-goals";
import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "../../types";

interface GoalPreviewData {
	description?: string | null;
	ignoreHistoricData?: boolean;
	name: string;
	target: string;
	type: "PAGE_VIEW" | "EVENT" | "CUSTOM";
}

export interface GoalPreviewProps extends BaseComponentProps {
	goal: GoalPreviewData;
	mode: "create" | "update" | "delete";
}

interface ModeConfig {
	accent: string;
	ButtonIcon: FC<SVGProps<SVGSVGElement> & { size?: number | string }>;
	confirmLabel: string;
	confirmMessage: string;
	title: string;
	variant: "default" | "destructive";
}

const MODE_CONFIG: Record<string, ModeConfig> = {
	create: {
		title: "Create Goal",
		confirmLabel: "Create",
		confirmMessage: "Yes, create it",
		accent: "",
		variant: "default",
		ButtonIcon: IconCheckFillDuo18,
	},
	update: {
		title: "Update Goal",
		confirmLabel: "Update",
		confirmMessage: "Yes, update it",
		accent: "border-amber-500/30",
		variant: "default",
		ButtonIcon: IconCheckFillDuo18,
	},
	delete: {
		title: "Delete Goal",
		confirmLabel: "Delete",
		confirmMessage: "Yes, delete it",
		accent: "border-destructive/30",
		variant: "destructive",
		ButtonIcon: IconTrashFillDuo18,
	},
};

export function GoalPreviewRenderer({
	mode,
	goal,
	className,
}: GoalPreviewProps) {
	const { sendMessage, status } = useChat();
	const params = useParams();
	const websiteId = params.id as string;

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);

	const { createGoal, isCreating } = useGoals(websiteId);

	const config = MODE_CONFIG[mode];
	const isLoading = status === "streaming" || status === "submitted";

	// Convert to Goal type for the dialog
	const goalForDialog: Goal = {
		id: "",
		websiteId,
		name: goal.name,
		description: goal.description ?? null,
		type: goal.type,
		target: goal.target,
		filters: [],
		ignoreHistoricData: goal.ignoreHistoricData ?? false,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdBy: "",
		deletedAt: null,
	};

	const handleConfirm = () => {
		setIsConfirming(true);
		sendMessage({ text: config.confirmMessage });
		setTimeout(() => setIsConfirming(false), 500);
	};

	const handleSaveFromDialog = useCallback(
		async (data: Goal | Omit<CreateGoalData, "websiteId">) => {
			try {
				await createGoal({
					websiteId,
					...data,
				} as CreateGoalData);
				setIsDialogOpen(false);
			} catch {
				toast.error("Failed to create goal");
			}
		},
		[createGoal, websiteId]
	);

	return (
		<>
			<Card
				className={cn(
					"gap-0 overflow-hidden border py-0",
					config.accent,
					className
				)}
			>
				<div className="flex items-center gap-2.5 border-b px-3 py-2">
					<div className="flex size-6 items-center justify-center rounded bg-accent">
						<IconTargetFillDuo18
							className="size-3.5 text-muted-foreground"
						/>
					</div>
					<p className="font-medium text-sm">{config.title}</p>
					<Badge className="ml-auto text-[10px]" variant="secondary">
						{goal.type === "PAGE_VIEW" ? "Page" : "Event"}
					</Badge>
				</div>

				<div className="px-3 py-3">
					<div className="space-y-2">
						<div>
							<p className="text-muted-foreground text-xs">Name</p>
							<p className="text-sm">{goal.name}</p>
						</div>
						{goal.description && (
							<div>
								<p className="text-muted-foreground text-xs">Description</p>
								<p className="text-sm">{goal.description}</p>
							</div>
						)}
						<div>
							<p className="mb-1.5 text-muted-foreground text-xs">Target</p>
							<div className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5">
								{goal.type === "EVENT" ? (
									<IconMouse2FillDuo18
										className="size-4 text-muted-foreground"
									/>
								) : (
									<IconEyeFillDuo18
										className="size-4 text-muted-foreground"
									/>
								)}
								<span className="min-w-0 flex-1 truncate font-mono text-xs">
									{goal.target}
								</span>
							</div>
						</div>
						{goal.ignoreHistoricData && (
							<p className="text-muted-foreground text-xs">
								Historic data will be ignored
							</p>
						)}
					</div>
				</div>

				<div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
					<Button
						disabled={isLoading || isConfirming}
						onClick={() => setIsDialogOpen(true)}
						size="sm"
						variant="ghost"
					>
						<IconPencilFillDuo18 className="size-3.5" />
						Edit
					</Button>
					<Button
						disabled={isLoading || isConfirming}
						onClick={handleConfirm}
						size="sm"
						variant={config.variant}
					>
						{isConfirming ? (
							<IconLoader2FillDuo18 className="size-3.5 animate-spin" />
						) : (
							<config.ButtonIcon className="size-3.5" />
						)}
						{config.confirmLabel}
					</Button>
				</div>
			</Card>

			<EditGoalDialog
				goal={mode === "create" ? null : goalForDialog}
				isOpen={isDialogOpen}
				isSaving={isCreating}
				onClose={() => setIsDialogOpen(false)}
				onSave={handleSaveFromDialog}
			/>
		</>
	);
}
