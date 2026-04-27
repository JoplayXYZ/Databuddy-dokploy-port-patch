"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeatureLockedPanel } from "@/components/feature-access-gate";
import { MonitorRow } from "@/components/monitors/monitor-row";
import { MonitorSheet } from "@/components/monitors/monitor-sheet";
import { FeatureInviteDialog } from "@/components/organizations/feature-invite-dialog";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
	ArrowClockwiseIcon,
	HeartbeatIcon,
	PlusIcon,
	UserPlusIcon,
} from "@databuddy/ui/icons";
import { Button, Card, EmptyState, Skeleton } from "@databuddy/ui";

export interface Monitor {
	cacheBust: boolean;
	createdAt: Date | string;
	cron: string;
	granularity: string;
	id: string;
	isPaused: boolean;
	jsonParsingConfig?: {
		enabled: boolean;
	} | null;
	name: string | null;
	organizationId: string;
	timeout: number | null;
	updatedAt: Date | string;
	url: string | null;
	website: {
		id: string;
		name: string | null;
		domain: string;
	} | null;
	websiteId: string | null;
}

export default function MonitorsPage() {
	const { hasAccess, isLoading: isAccessLoading } =
		useFeatureAccess("monitors");
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [showInviteDialog, setShowInviteDialog] = useState(false);
	const [editingSchedule, setEditingSchedule] = useState<{
		id: string;
		url: string;
		name?: string | null;
		granularity: string;
		timeout?: number | null;
		cacheBust?: boolean;
		jsonParsingConfig?: {
			enabled: boolean;
		} | null;
	} | null>(null);

	const schedulesQuery = useQuery({
		...orpc.uptime.listSchedules.queryOptions({ input: {} }),
		enabled: hasAccess,
	});

	const handleCreate = () => {
		setEditingSchedule(null);
		setIsSheetOpen(true);
	};

	const handleEdit = (schedule: Monitor) => {
		setEditingSchedule({
			id: schedule.id,
			url: schedule.url ?? "",
			name: schedule.name,
			granularity: schedule.granularity,
			timeout: schedule.timeout,
			cacheBust: schedule.cacheBust,
			jsonParsingConfig: schedule.jsonParsingConfig,
		});
		setIsSheetOpen(true);
	};

	const handleDelete = () => {
		schedulesQuery.refetch();
	};

	const handleSheetClose = () => {
		setIsSheetOpen(false);
		setEditingSchedule(null);
	};

	const monitors = (schedulesQuery.data ?? []) as Monitor[];
	const isLoading = isAccessLoading || (hasAccess && schedulesQuery.isLoading);

	return (
		<ErrorBoundary>
			<div className="flex-1 overflow-y-auto">
				{isAccessLoading || hasAccess ? (
					<div className="mx-auto max-w-2xl space-y-6 p-5">
						<Card>
							<Card.Header className="flex-row items-start justify-between gap-4">
								<div>
									<Card.Title>Monitors</Card.Title>
									<Card.Description>
										{isLoading
											? "Loading monitors…"
											: monitors.length === 0
												? "Track availability and receive alerts"
												: `${monitors.length} monitor${monitors.length === 1 ? "" : "s"}`}
									</Card.Description>
								</div>
								{hasAccess && (
									<div className="flex items-center gap-2">
										<Button
											onClick={() => setShowInviteDialog(true)}
											size="sm"
											variant="secondary"
										>
											<UserPlusIcon className="size-3.5" weight="duotone" />
											Invite
										</Button>
										<Button
											aria-label="Refresh monitors"
											disabled={
												schedulesQuery.isLoading || schedulesQuery.isFetching
											}
											onClick={() => schedulesQuery.refetch()}
											size="sm"
											variant="ghost"
										>
											<ArrowClockwiseIcon
												className={cn(
													"size-3.5",
													(schedulesQuery.isLoading ||
														schedulesQuery.isFetching) &&
														"animate-spin"
												)}
											/>
										</Button>
										<Button onClick={handleCreate} size="sm">
											<PlusIcon className="size-3.5" />
											Create Monitor
										</Button>
									</div>
								)}
							</Card.Header>
							<Card.Content className="p-0">
								{isLoading && (
									<div className="divide-y">
										{Array.from({ length: 3 }).map((_, i) => (
											<div
												className="flex items-center gap-4 px-5 py-3"
												key={`skel-${i + 1}`}
											>
												<Skeleton className="size-10 shrink-0 rounded-lg" />
												<div className="min-w-0 flex-1 space-y-2">
													<div className="flex items-center gap-2">
														<Skeleton className="h-4 w-40" />
														<Skeleton className="h-4 w-16 rounded-full" />
													</div>
													<Skeleton className="h-3.5 w-56" />
												</div>
											</div>
										))}
									</div>
								)}

								{!isLoading && monitors.length === 0 && (
									<div className="px-5 py-12">
										<EmptyState
											action={
												<Button
													onClick={handleCreate}
													size="sm"
													variant="secondary"
												>
													<PlusIcon className="size-3.5" />
													Create Monitor
												</Button>
											}
											description="Create your first uptime monitor to start tracking availability and receive alerts when services go down."
											icon={<HeartbeatIcon weight="duotone" />}
											title="No monitors yet"
										/>
									</div>
								)}

								{!isLoading && monitors.length > 0 && (
									<div className="divide-y">
										{monitors.map((monitor) => (
											<MonitorRow
												key={monitor.id}
												onDeleteAction={handleDelete}
												onEditAction={() => handleEdit(monitor)}
												onRefetchAction={schedulesQuery.refetch}
												schedule={monitor}
											/>
										))}
									</div>
								)}
							</Card.Content>
						</Card>
					</div>
				) : (
					<FeatureLockedPanel flagKey="monitors" />
				)}

				{isSheetOpen && (
					<Suspense fallback={null}>
						<MonitorSheet
							onCloseAction={handleSheetClose}
							onSaveAction={schedulesQuery.refetch}
							open={isSheetOpen}
							schedule={editingSchedule}
						/>
					</Suspense>
				)}
				{showInviteDialog && (
					<FeatureInviteDialog
						flagKey="monitors"
						onOpenChangeAction={setShowInviteDialog}
						open={showInviteDialog}
					/>
				)}
			</div>
		</ErrorBoundary>
	);
}
