"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { getFeatureLabel } from "@/lib/feature-gates";
import { orpc } from "@/lib/orpc";
import { CheckIcon, CopyIcon, HeartbeatIcon } from "@databuddy/ui/icons";
import { Dialog } from "@databuddy/ui/client";
import { Badge, Skeleton } from "@databuddy/ui";

interface FeatureInviteDialogProps {
	flagKey: string;
	onOpenChangeAction: (open: boolean) => void;
	open: boolean;
}

interface InviteLink {
	createdAt: string | Date;
	id: string;
	redeemedById: string | null;
	status: string;
	token: string;
}

function InviteLinkRow({ link }: { link: InviteLink }) {
	const url = `${globalThis.location?.origin ?? ""}/invite/${link.token}`;
	const isRedeemed = link.status === "redeemed";
	const { isCopied, copyToClipboard } = useCopyToClipboard({
		onCopy: () => toast.success("Invite link copied to clipboard"),
	});

	return (
		<div className="group flex items-center gap-3 rounded border bg-card px-3 py-2.5">
			<code className="flex-1 select-all text-xs tabular-nums">
				{link.token}
			</code>

			{isRedeemed ? (
				<Badge variant="success">Claimed</Badge>
			) : (
				<button
					aria-label="Copy invite link"
					className="flex size-7 shrink-0 items-center justify-center rounded border bg-secondary text-foreground transition-colors hover:bg-accent"
					onClick={() => copyToClipboard(url)}
					type="button"
				>
					{isCopied ? (
						<CheckIcon className="size-3.5 text-green-600" weight="bold" />
					) : (
						<CopyIcon className="size-3.5" weight="duotone" />
					)}
				</button>
			)}
		</div>
	);
}

function InviteLinksContent({ flagKey }: { flagKey: string }) {
	const { data: links, isLoading } = useQuery({
		...orpc.featureInvite.generateLinks.queryOptions({
			input: { flagKey },
		}),
	});

	const label = getFeatureLabel(flagKey);
	const activeCount = links?.filter((l) => l.status === "active").length ?? 0;
	const usedCount = links?.filter((l) => l.status === "redeemed").length ?? 0;

	return (
		<div className="space-y-5">
			<div className="space-y-1 text-balance text-center">
				<div className="mx-auto mb-3 flex size-10 items-center justify-center rounded border bg-secondary">
					<HeartbeatIcon className="size-5 text-foreground" weight="duotone" />
				</div>
				<p className="font-medium text-foreground text-sm">
					You have access to {label}
				</p>
				<p className="text-muted-foreground text-xs">
					You have {activeCount} invite{activeCount === 1 ? "" : "s"} left. Each
					link grants one person permanent access.
				</p>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton
							className="h-10 w-full rounded"
							key={`skeleton-${i + 1}`}
						/>
					))}
				</div>
			) : (
				<div className="space-y-2">
					{(links ?? []).map((link) => (
						<InviteLinkRow key={link.id} link={link} />
					))}
				</div>
			)}

			{usedCount > 0 ? (
				<p className="text-center text-muted-foreground text-xs">
					{usedCount} of your invites have been claimed
				</p>
			) : null}
		</div>
	);
}

export function FeatureInviteDialog({
	open,
	onOpenChangeAction,
	flagKey,
}: FeatureInviteDialogProps) {
	const isMobile = useIsMobile();

	const content = <InviteLinksContent flagKey={flagKey} />;

	if (isMobile) {
		return (
			<Drawer onOpenChange={onOpenChangeAction} open={open}>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>Your Invites</DrawerTitle>
					</DrawerHeader>
					<div className="p-5">{content}</div>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog onOpenChange={onOpenChangeAction} open={open}>
			<Dialog.Content className="w-[95vw] max-w-sm sm:w-full">
				<Dialog.Close />
				<Dialog.Header>
					<Dialog.Title>Your Invites</Dialog.Title>
				</Dialog.Header>
				<Dialog.Body>{content}</Dialog.Body>
			</Dialog.Content>
		</Dialog>
	);
}
