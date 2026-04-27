"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeatureLockedPanel } from "@/components/feature-access-gate";
import { FeatureInviteDialog } from "@/components/organizations/feature-invite-dialog";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import {
	type StatusPage,
	StatusPageRow,
} from "@/components/status-pages/status-page-row";
import { StatusPageSheet } from "@/components/status-pages/status-page-sheet";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { DeleteDialog } from "@/components/ds/delete-dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@databuddy/ui";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { BrowserIcon } from "@phosphor-icons/react/dist/ssr";
import {
	ArrowClockwiseIcon,
	PlusIcon,
	UserPlusIcon,
} from "@databuddy/ui/icons";

export default function StatusPagesListPage() {
	const { hasAccess, isLoading: isAccessLoading } =
		useFeatureAccess("monitors");
	const { activeOrganizationId, activeOrganization } =
		useOrganizationsContext();
	const queryClient = useQueryClient();
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [showInviteDialog, setShowInviteDialog] = useState(false);
	const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(
		null
	);
	const [statusPageToDelete, setStatusPageToDelete] =
		useState<StatusPage | null>(null);

	const resolvedOrgId = activeOrganization?.id ?? activeOrganizationId ?? "";

	const statusPagesQuery = useQuery({
		...orpc.statusPage.list.queryOptions({
			input: { organizationId: resolvedOrgId },
		}),
		enabled: hasAccess && !!resolvedOrgId,
	});

	const deleteMutation = useMutation({
		...orpc.statusPage.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.statusPage.list.key(),
			});
			toast.success("Status page deleted");
			setStatusPageToDelete(null);
		},
	});

	const handleCreate = () => {
		setEditingStatusPage(null);
		setIsSheetOpen(true);
	};

	const handleEdit = (statusPage: StatusPage) => {
		setEditingStatusPage(statusPage);
		setIsSheetOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!statusPageToDelete) {
			return;
		}
		await deleteMutation.mutateAsync({ statusPageId: statusPageToDelete.id });
	};

	const handleSheetClose = () => {
		setIsSheetOpen(false);
		setEditingStatusPage(null);
	};

	const statusPages = statusPagesQuery.data;
	const isLoading =
		isAccessLoading || (hasAccess && statusPagesQuery.isLoading);

	return (
		<ErrorBoundary>
			<div className="flex-1 overflow-y-auto">
				{isAccessLoading || hasAccess ? (
					<div className="mx-auto max-w-2xl space-y-6 p-5">
						<Card>
							<Card.Header className="flex-row items-start justify-between gap-4">
								<div>
									<Card.Title>Status Pages</Card.Title>
									<Card.Description>
										{isLoading
											? "Loading status pages…"
											: statusPages && statusPages.length === 0
												? "Create and manage public status pages"
												: `${statusPages?.length ?? 0} status page${statusPages?.length === 1 ? "" : "s"}`}
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
											aria-label="Refresh status pages"
											disabled={
												statusPagesQuery.isLoading ||
												statusPagesQuery.isFetching
											}
											onClick={() => statusPagesQuery.refetch()}
											size="sm"
											variant="ghost"
										>
											<ArrowClockwiseIcon
												className={cn(
													"size-3.5",
													(statusPagesQuery.isLoading ||
														statusPagesQuery.isFetching) &&
														"animate-spin"
												)}
											/>
										</Button>
										<Button onClick={handleCreate} size="sm">
											<PlusIcon className="size-3.5" />
											Create Status Page
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

								{!isLoading && statusPages && statusPages.length === 0 && (
									<div className="px-5 py-12">
										<EmptyState
											action={
												<Button
													onClick={handleCreate}
													size="sm"
													variant="secondary"
												>
													<PlusIcon className="size-3.5" />
													Create Status Page
												</Button>
											}
											description="Create a public status page to keep your users informed about system availability."
											icon={<BrowserIcon weight="duotone" />}
											title="No status pages yet"
										/>
									</div>
								)}

								{!isLoading && statusPages && statusPages.length > 0 && (
									<div className="divide-y">
										{statusPages.map((statusPage) => (
											<StatusPageRow
												key={statusPage.id}
												onDeleteAction={() => setStatusPageToDelete(statusPage)}
												onEditAction={() => handleEdit(statusPage)}
												onTransferSuccessAction={statusPagesQuery.refetch}
												statusPage={statusPage}
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
						<StatusPageSheet
							onCloseAction={handleSheetClose}
							onSaveAction={statusPagesQuery.refetch}
							open={isSheetOpen}
							statusPage={editingStatusPage}
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

				<DeleteDialog
					isDeleting={deleteMutation.isPending}
					isOpen={statusPageToDelete !== null}
					itemName={statusPageToDelete?.name}
					onClose={() => setStatusPageToDelete(null)}
					onConfirm={handleConfirmDelete}
					title="Delete Status Page"
				/>
			</div>
		</ErrorBoundary>
	);
}
