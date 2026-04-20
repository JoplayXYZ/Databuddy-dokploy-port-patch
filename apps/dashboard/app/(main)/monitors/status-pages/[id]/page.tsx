"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { BrowserIcon } from "@phosphor-icons/react";
import { HeartbeatIcon } from "@phosphor-icons/react";
import { PlusIcon } from "@phosphor-icons/react";
import { SirenIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ds/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeatureLockedPanel } from "@/components/feature-access-gate";
import { PageNavigation } from "@/components/layout/page-navigation";
import { TransferToOrgDialog } from "@/components/transfer-to-org-dialog";
import { Badge } from "@/components/ds/badge";
import { Button, buttonVariants } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { DeleteDialog } from "@/components/ds/delete-dialog";
import { Field } from "@/components/ds/field";
import { Skeleton } from "@/components/ds/skeleton";
import { Switch } from "@/components/ds/switch";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { getStatusPageUrl } from "@/lib/app-url";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { AddMonitorDialog } from "./_components/add-monitor-dialog";
import {
	type StatusPageMonitor,
	StatusPageMonitorRow,
} from "./_components/status-page-monitor-row";

export default function StatusPageDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const statusPageId = params.id as string;
	const queryClient = useQueryClient();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isTransferOpen, setIsTransferOpen] = useState(false);
	const [includeMonitors, setIncludeMonitors] = useState(true);
	const [monitorToRemove, setMonitorToRemove] = useState<string | null>(null);

	const statusPageQuery = useQuery({
		...orpc.statusPage.get.queryOptions({ input: { statusPageId } }),
		enabled: !!statusPageId,
	});

	const transferMutation = useMutation({
		...orpc.statusPage.transfer.mutationOptions(),
	});

	const removeMutation = useMutation({
		...orpc.statusPage.removeMonitor.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Monitor removed");
			setMonitorToRemove(null);
		},
	});

	const statusPage = statusPageQuery.data;

	const { hasAccess, isLoading: isFeatureAccessLoading } =
		useFeatureAccess("monitors");

	const monitorToRemoveData = statusPage?.monitors.find(
		(m: StatusPageMonitor) => m.id === monitorToRemove
	);

	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: orpc.statusPage.get.key({ input: { statusPageId } }),
		});
	};

	const handleTransfer = async (targetOrganizationId: string) => {
		try {
			await transferMutation.mutateAsync({
				statusPageId,
				targetOrganizationId,
				includeMonitors,
			});
			toast.success("Status page transferred successfully");
			setIsTransferOpen(false);
			router.push("/monitors/status-pages");
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to transfer status page";
			toast.error(errorMessage);
		}
	};

	const handleConfirmRemove = async () => {
		if (!monitorToRemoveData) {
			return;
		}
		await removeMutation.mutateAsync({
			statusPageId: monitorToRemoveData.statusPageId,
			uptimeScheduleId: monitorToRemoveData.uptimeScheduleId,
		});
	};

	const isLoading = isFeatureAccessLoading || statusPageQuery.isLoading;

	let monitorsContent: ReactNode;
	if (!(hasAccess || isFeatureAccessLoading)) {
		monitorsContent = <FeatureLockedPanel flagKey="monitors" />;
	} else if (isLoading) {
		monitorsContent = (
			<div className="divide-y">
				{Array.from({ length: 3 }).map((_, i) => (
					<div
						className="flex items-center gap-4 px-5 py-3"
						key={`skel-${i + 1}`}
					>
						<Skeleton className="size-8 shrink-0 rounded-lg" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-56" />
						</div>
					</div>
				))}
			</div>
		);
	} else if (statusPageQuery.isError) {
		monitorsContent = (
			<div className="px-5 py-12">
				<EmptyState
					action={{
						label: "Retry",
						onClick: () => statusPageQuery.refetch(),
					}}
					description="Something went wrong while loading the status page."
					icon={<BrowserIcon weight="duotone" />}
					title="Failed to load"
					variant="error"
				/>
			</div>
		);
	} else if (statusPage?.monitors.length === 0) {
		monitorsContent = (
			<div className="px-5 py-12">
				<EmptyState
					action={
						<Button
							onClick={() => setIsDialogOpen(true)}
							size="sm"
							variant="secondary"
						>
							<PlusIcon className="size-3.5" />
							Add Monitor
						</Button>
					}
					description="Add an existing monitor or create a new one to display on this status page."
					icon={<HeartbeatIcon weight="duotone" />}
					title="No monitors added"
				/>
			</div>
		);
	} else {
		monitorsContent = (
			<div className="divide-y">
				{statusPage?.monitors.map((monitor: StatusPageMonitor) => (
					<StatusPageMonitorRow
						key={monitor.id}
						monitor={monitor}
						onRemoveRequestAction={(id) => setMonitorToRemove(id)}
						statusPageId={statusPageId}
					/>
				))}
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<div className="flex h-full min-h-0 flex-col">
				<PageNavigation
					breadcrumb={{
						label: "Status Pages",
						href: "/monitors/status-pages",
					}}
					currentPage={statusPage?.name ?? "Status page"}
					variant="breadcrumb"
				/>

				<div className="flex-1 overflow-y-auto">
					<div className="mx-auto max-w-2xl space-y-6 p-5">
						<Card>
							<Card.Header className="flex-row items-start justify-between gap-4">
								<div>
									<Card.Title>
										{statusPage?.name ?? <Skeleton className="h-5 w-40" />}
									</Card.Title>
									<Card.Description>
										{isLoading
											? "Loading…"
											: `${statusPage?.monitors.length ?? 0} monitor${statusPage?.monitors.length === 1 ? "" : "s"} on this page`}
									</Card.Description>
								</div>
								<div className="flex items-center gap-2">
									{statusPage ? (
										<>
											<Link
												className={buttonVariants({
													size: "sm",
													variant: "secondary",
												})}
												href={getStatusPageUrl(statusPage.slug)}
												rel="noopener noreferrer"
												target="_blank"
											>
												View Page
											</Link>
											<Button
												aria-label="Refresh data"
												disabled={
													statusPageQuery.isLoading ||
													statusPageQuery.isFetching
												}
												onClick={() => statusPageQuery.refetch()}
												size="sm"
												variant="ghost"
											>
												<ArrowClockwiseIcon
													className={cn(
														"size-3.5",
														(statusPageQuery.isLoading ||
															statusPageQuery.isFetching) &&
															"animate-spin"
													)}
												/>
											</Button>
											<Button
												onClick={() => setIsTransferOpen(true)}
												size="sm"
												variant="secondary"
											>
												<ArrowSquareOutIcon
													className="size-3.5"
													weight="duotone"
												/>
												<span className="hidden sm:inline">Transfer</span>
											</Button>
											<Button onClick={() => setIsDialogOpen(true)} size="sm">
												<PlusIcon className="size-3.5" />
												Add Monitor
											</Button>
										</>
									) : (
										<>
											<Skeleton className="h-8 w-22 rounded" />
											<Skeleton className="size-8 rounded" />
											<Skeleton className="h-8 w-24 rounded" />
										</>
									)}
								</div>
							</Card.Header>

							<div className="flex h-10 shrink-0 border-border border-t bg-accent/30">
								<button
									className="relative flex cursor-pointer items-center gap-2 px-3 py-2.5 font-medium text-foreground text-sm"
									type="button"
								>
									<span className="inline-flex">
										<HeartbeatIcon
											className="size-4 text-primary"
											weight="fill"
										/>
									</span>
									Monitors
									<div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-purple" />
								</button>
								<button
									className="flex cursor-not-allowed items-center gap-2 px-3 py-2.5 font-medium text-muted-foreground/50 text-sm"
									disabled
									type="button"
								>
									<span className="inline-flex">
										<SirenIcon className="size-4" weight="duotone" />
									</span>
									Incidents
									<Badge className="px-1.5 py-0" variant="muted">
										Soon
									</Badge>
								</button>
							</div>

							<Card.Content className="p-0">{monitorsContent}</Card.Content>
						</Card>
					</div>
				</div>

				<AddMonitorDialog
					existingMonitorIds={
						statusPage?.monitors.map(
							(m: StatusPageMonitor) => m.uptimeScheduleId
						) ?? []
					}
					onCompleteAction={invalidate}
					onOpenChangeAction={setIsDialogOpen}
					open={isDialogOpen}
					statusPageId={statusPageId}
				/>

				<DeleteDialog
					confirmLabel="Remove"
					description="This monitor will no longer appear on the public status page."
					isDeleting={removeMutation.isPending}
					isOpen={monitorToRemove !== null}
					itemName={
						monitorToRemoveData?.uptimeSchedule.name ??
						monitorToRemoveData?.uptimeSchedule.url ??
						undefined
					}
					onClose={() => setMonitorToRemove(null)}
					onConfirm={handleConfirmRemove}
					title="Remove Monitor"
				/>

				{statusPage ? (
					<TransferToOrgDialog
						currentOrganizationId={statusPage.organizationId}
						description={`Move "${statusPage.name}" to a different workspace.`}
						isPending={transferMutation.isPending}
						onOpenChangeAction={setIsTransferOpen}
						onTransferAction={handleTransfer}
						open={isTransferOpen}
						title="Transfer Status Page"
						warning="The status page and its configuration will be transferred to {orgName}."
					>
						<div className="flex items-center justify-between rounded border p-3">
							<Field.Label
								className="cursor-pointer text-sm"
								htmlFor="include-monitors-detail"
							>
								Include all linked monitors
							</Field.Label>
							<Switch
								checked={includeMonitors}
								id="include-monitors-detail"
								onCheckedChange={setIncludeMonitors}
							/>
						</div>
					</TransferToOrgDialog>
				) : null}
			</div>
		</ErrorBoundary>
	);
}
