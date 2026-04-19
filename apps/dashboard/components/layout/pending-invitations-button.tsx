"use client";

import { BuildingsIcon, EnvelopeIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ds/badge";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Tooltip } from "@/components/ds/tooltip";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useUserInvitations } from "./hooks/use-user-invitations";

export function PendingInvitationsButton() {
	const [isOpen, setIsOpen] = useState(false);
	const { invitations, count, isLoading } = useUserInvitations();

	if (isLoading || count === 0) {
		return null;
	}

	return (
		<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip
				content={`${count} pending invitation${count === 1 ? "" : "s"}`}
				side="right"
			>
				<DropdownMenu.Trigger
					aria-label={`${count} pending invitations`}
					className={cn(
						"relative flex size-8 items-center justify-center rounded-md",
						"transition-colors duration-(--duration-quick) ease-(--ease-smooth)",
						"hover:bg-interactive-hover",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					)}
				>
					<EnvelopeIcon
						className="size-5 text-sidebar-foreground/75"
						weight="duotone"
					/>
					<Badge
						className={cn(
							"absolute -top-1 -right-1 flex size-4 items-center justify-center bg-destructive p-0 text-[10px] text-destructive-foreground",
							"zoom-in-50 animate-in duration-200"
						)}
					>
						{count > 9 ? "9+" : count}
					</Badge>
				</DropdownMenu.Trigger>
			</Tooltip>

			<DropdownMenu.Content align="start" className="w-72" side="right">
				<DropdownMenu.Group>
					<DropdownMenu.GroupLabel>Pending Invitations</DropdownMenu.GroupLabel>
				</DropdownMenu.Group>
				{invitations.map((invitation) => (
					<DropdownMenu.Item
						className="h-auto items-start gap-3 py-2"
						key={invitation.id}
						render={
							<Link
								href={`/invitations/${invitation.id}`}
								onClick={() => setIsOpen(false)}
							/>
						}
					>
						<div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10">
							<BuildingsIcon className="size-4 text-primary" weight="duotone" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-sm">
								{invitation.organizationName}
							</p>
							<p className="text-muted-foreground text-xs">
								{invitation.role} · expires{" "}
								{dayjs(invitation.expiresAt).fromNow()}
							</p>
						</div>
					</DropdownMenu.Item>
				))}
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
