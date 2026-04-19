"use client";

import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { InviteMemberDialog } from "@/components/organizations/invite-member-dialog";
import { useOrganizationInvitations } from "@/hooks/use-organization-invitations";
import type {
	ActiveOrganization,
	Organization,
} from "@/hooks/use-organizations";
import {
	ArrowClockwise,
	Envelope,
	UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { InvitationsSkeleton } from "../components/settings-skeletons";
import { InvitationList } from "./invitation-list";

export function InvitationsView({
	organization,
}: {
	organization: NonNullable<Organization | ActiveOrganization>;
}) {
	const [showInviteDialog, setShowInviteDialog] = useState(false);
	const {
		invitations,
		isLoading,
		error,
		isCancelling,
		pendingCount,
		cancelInvitation,
		refetch,
	} = useOrganizationInvitations(organization.id);

	if (isLoading) {
		return <InvitationsSkeleton />;
	}

	if (error) {
		return (
			<Card>
				<Card.Content className="py-12">
					<EmptyState
						action={
							<Button onClick={() => refetch()} variant="secondary">
								<ArrowClockwise size={14} />
								Try again
							</Button>
						}
						description="Something went wrong while loading invitations"
						icon={<Envelope weight="duotone" />}
						title="Failed to load"
					/>
				</Card.Content>
			</Card>
		);
	}

	const totalCount = invitations.length;

	return (
		<>
			<Card>
				<Card.Header className="flex-row items-start justify-between gap-4">
					<div>
						<Card.Title>Invitations</Card.Title>
						<Card.Description>
							{totalCount === 0
								? "Invite people to join this workspace"
								: `${pendingCount} pending of ${totalCount} total`}
						</Card.Description>
					</div>
					<Button
						onClick={() => setShowInviteDialog(true)}
						size="sm"
						variant="secondary"
					>
						<UserPlus size={14} />
						Invite
					</Button>
				</Card.Header>
				{totalCount > 0 && (
					<Card.Content className="p-0">
						<InvitationList
							invitations={invitations}
							isCancellingInvitation={isCancelling}
							onCancelInvitationAction={cancelInvitation}
						/>
					</Card.Content>
				)}
			</Card>

			<InviteMemberDialog
				onOpenChangeAction={setShowInviteDialog}
				open={showInviteDialog}
				organizationId={organization.id}
			/>
		</>
	);
}
