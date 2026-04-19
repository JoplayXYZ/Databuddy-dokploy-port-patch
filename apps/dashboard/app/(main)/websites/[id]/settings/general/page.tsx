"use client";

import {
	ArrowSquareOutIcon,
	CheckIcon,
	ClipboardIcon,
	InfoIcon,
	PencilSimpleIcon,
	TrashIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { NoticeBanner } from "@/app/(main)/websites/_components/notice-banner";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Divider } from "@/components/ds/divider";
import { Switch } from "@/components/ds/switch";
import { DeleteDialog } from "@/components/ds/delete-dialog";
import { WebsiteDialog } from "@/components/website-dialog";
import {
	updateWebsiteCache,
	useDeleteWebsite,
	useWebsite,
	type Website,
} from "@/hooks/use-websites";
import { orpc } from "@/lib/orpc";
import { TOAST_MESSAGES } from "../../_components/shared/tracking-constants";

function SettingsRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{label}</p>
				{description && (
					<p className="text-muted-foreground text-xs">{description}</p>
				)}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

export default function GeneralSettingsPage() {
	const params = useParams();
	const router = useRouter();
	const websiteId = params.id as string;
	const { data: websiteData, refetch } = useWebsite(websiteId);
	const deleteWebsiteMutation = useDeleteWebsite();
	const queryClient = useQueryClient();

	const [showEditDialog, setShowEditDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [copiedWebsiteId, setCopiedWebsiteId] = useState(false);

	const toggleMutation = useMutation({
		...orpc.websites.togglePublic.mutationOptions(),
		onSuccess: (updatedWebsite: Website) => {
			updateWebsiteCache(queryClient, updatedWebsite);
		},
	});

	const isPublic = websiteData?.isPublic ?? false;
	const shareableLink = websiteData
		? `${window.location.origin}/public/${websiteId}`
		: "";

	const handleWebsiteUpdated = useCallback(() => {
		setShowEditDialog(false);
		refetch();
	}, [refetch]);

	const handleDeleteWebsite = useCallback(async () => {
		if (!websiteData) {
			return;
		}
		try {
			await toast.promise(
				deleteWebsiteMutation.mutateAsync({ id: websiteId }),
				{
					loading: TOAST_MESSAGES.WEBSITE_DELETING,
					success: () => {
						router.push("/websites");
						return TOAST_MESSAGES.WEBSITE_DELETED;
					},
					error: TOAST_MESSAGES.WEBSITE_DELETE_ERROR,
				}
			);
		} catch {
			// handled by toast
		}
	}, [websiteData, websiteId, deleteWebsiteMutation, router]);

	const handleCopyWebsiteId = useCallback(() => {
		navigator.clipboard.writeText(websiteId);
		setCopiedWebsiteId(true);
		toast.success("Website ID copied to clipboard");
		setTimeout(() => setCopiedWebsiteId(false), 2000);
	}, [websiteId]);

	const handleTogglePublic = useCallback(() => {
		if (!websiteData) {
			return;
		}
		toast.promise(
			toggleMutation.mutateAsync({ id: websiteId, isPublic: !isPublic }),
			{
				loading: "Updating privacy settings...",
				success: "Privacy settings updated",
				error: "Failed to update privacy settings",
			}
		);
	}, [websiteData, websiteId, isPublic, toggleMutation]);

	const handleCopyLink = useCallback(() => {
		if (!shareableLink) {
			return;
		}
		navigator.clipboard.writeText(shareableLink);
		toast.success("Link copied to clipboard!");
	}, [shareableLink]);

	if (!websiteData) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="mx-auto max-w-2xl space-y-6 p-5">
				<Card>
					<Card.Header>
						<Card.Title>Website Details</Card.Title>
						<Card.Description>Name, domain, and identifiers</Card.Description>
					</Card.Header>
					<Card.Content className="space-y-4">
						<SettingsRow label="Website ID">
							<div className="flex items-center gap-2">
								<code className="font-mono text-muted-foreground text-xs">
									{websiteId}
								</code>
								<Button
									onClick={handleCopyWebsiteId}
									size="sm"
									variant="secondary"
								>
									{copiedWebsiteId ? (
										<>
											<CheckIcon className="size-3.5" weight="bold" />
											Copied
										</>
									) : (
										<>
											<ClipboardIcon className="size-3.5" weight="duotone" />
											Copy
										</>
									)}
								</Button>
							</div>
						</SettingsRow>

						<Divider />

						<SettingsRow
							description={websiteData.name || "Not set"}
							label="Name"
						>
							<Button
								onClick={() => setShowEditDialog(true)}
								size="sm"
								variant="secondary"
							>
								<PencilSimpleIcon className="size-3.5" />
								Edit
							</Button>
						</SettingsRow>

						<Divider />

						<SettingsRow
							description={websiteData.domain || "Not set"}
							label="Domain"
						>
							<Button
								onClick={() => setShowEditDialog(true)}
								size="sm"
								variant="secondary"
							>
								<PencilSimpleIcon className="size-3.5" />
								Edit
							</Button>
						</SettingsRow>
					</Card.Content>
				</Card>

				<Card>
					<Card.Header>
						<Card.Title>Privacy & Sharing</Card.Title>
						<Card.Description>
							Control public access to your analytics overview
						</Card.Description>
					</Card.Header>
					<Card.Content className="space-y-4">
						<SettingsRow
							description="Anyone with the link sees the overview only — no settings or other tabs"
							label="Public sharing"
						>
							<Switch
								aria-label="Toggle public access"
								checked={isPublic}
								onCheckedChange={handleTogglePublic}
							/>
						</SettingsRow>

						{isPublic && (
							<>
								<Divider />
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<p className="font-medium text-sm">Public overview link</p>
										<Badge variant="muted">Read-only</Badge>
									</div>
									<div className="flex items-center gap-2">
										<code className="flex-1 overflow-x-auto break-all rounded border bg-secondary px-3 py-2 font-mono text-xs">
											{shareableLink}
										</code>
										<Button
											aria-label="Copy public overview link"
											onClick={handleCopyLink}
											size="sm"
											variant="ghost"
										>
											<ClipboardIcon className="size-4" />
										</Button>
									</div>
									<NoticeBanner
										description="This URL opens your public overview only. Visitors cannot access settings, other analytics sections, or delete your site."
										icon={<InfoIcon />}
									/>
								</div>
							</>
						)}
					</Card.Content>
				</Card>

				<Card>
					<Card.Header>
						<Card.Title>Danger Zone</Card.Title>
						<Card.Description>
							Irreversible actions for this website
						</Card.Description>
					</Card.Header>
					<Card.Content className="space-y-4">
						<SettingsRow
							description="Move to another organization"
							label="Transfer website"
						>
							<Button
								onClick={() =>
									router.push(`/websites/${websiteId}/settings/transfer`)
								}
								size="sm"
								variant="secondary"
							>
								<ArrowSquareOutIcon className="size-3.5" />
								Transfer
							</Button>
						</SettingsRow>

						<Divider />

						<SettingsRow
							description="Permanently delete this website and all its data"
							label="Delete website"
						>
							<Button
								onClick={() => setShowDeleteDialog(true)}
								size="sm"
								tone="danger"
							>
								<TrashIcon className="size-3.5" />
								Delete
							</Button>
						</SettingsRow>
					</Card.Content>
				</Card>
			</div>

			<WebsiteDialog
				onOpenChange={setShowEditDialog}
				onSave={handleWebsiteUpdated}
				open={showEditDialog}
				website={websiteData}
			/>
			<DeleteDialog
				confirmLabel="Delete Website"
				description={`Are you sure you want to delete ${websiteData.name || websiteData.domain}?`}
				isDeleting={deleteWebsiteMutation.isPending}
				isOpen={showDeleteDialog}
				itemName={websiteData.name || websiteData.domain}
				onClose={() => setShowDeleteDialog(false)}
				onConfirm={handleDeleteWebsite}
				title="Delete Website"
			>
				<div className="rounded border bg-secondary p-3 text-sm">
					<div className="flex items-start gap-2">
						<WarningCircleIcon className="size-5 shrink-0 text-destructive" />
						<div className="space-y-1">
							<p className="font-medium">Warning:</p>
							<ul className="list-disc space-y-1 pl-4 text-xs">
								<li>All analytics data will be permanently deleted</li>
								<li>Tracking will stop immediately</li>
								<li>All website settings will be lost</li>
							</ul>
						</div>
					</div>
				</div>
			</DeleteDialog>
		</div>
	);
}
