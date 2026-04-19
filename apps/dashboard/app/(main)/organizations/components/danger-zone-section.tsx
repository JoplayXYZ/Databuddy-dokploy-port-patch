"use client";

import { authClient } from "@databuddy/auth/client";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Dialog } from "@/components/ds/dialog";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Text } from "@/components/ds/text";
import { type Organization, useOrganizations } from "@/hooks/use-organizations";
import { SignOut, Trash, Warning } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TransferAssets } from "./transfer-assets";

export function DangerZoneSection({
	organization,
}: {
	organization: Organization;
}) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showLeaveDialog, setShowLeaveDialog] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isLeaving, setIsLeaving] = useState(false);
	const [isOwner, setIsOwner] = useState<boolean | null>(null);
	const [confirmText, setConfirmText] = useState("");

	const { deleteOrganization, leaveOrganization } = useOrganizations();

	useEffect(() => {
		const checkOwnership = async () => {
			if (!session?.user?.id) {
				return;
			}
			try {
				const { data: fullOrgData } =
					await authClient.organization.getFullOrganization({
						query: { organizationId: organization.id },
					});
				const member = fullOrgData?.members?.find(
					(m) => m.userId === session.user.id
				);
				setIsOwner(member?.role === "owner");
			} catch {
				setIsOwner(false);
			}
		};
		checkOwnership();
	}, [organization.id, session?.user?.id]);

	const handleDelete = () => {
		if (confirmText !== organization.name) {
			toast.error("Organization name does not match");
			return;
		}
		setIsDeleting(true);
		deleteOrganization(organization.id, {
			onSuccess: () => {
				router.push("/organizations");
				setIsDeleting(false);
				setShowDeleteDialog(false);
				setConfirmText("");
			},
			onError: () => {
				setIsDeleting(false);
			},
		});
	};

	const handleLeave = () => {
		setIsLeaving(true);
		leaveOrganization(organization.id, {
			onSuccess: () => {
				router.push("/organizations");
				setIsLeaving(false);
				setShowLeaveDialog(false);
			},
			onError: () => {
				setIsLeaving(false);
			},
		});
	};

	return (
		<>
			<Card>
				<Card.Header>
					<Card.Title>Transfer Assets</Card.Title>
					<Card.Description>
						Move websites from this workspace to another
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<TransferAssets organizationId={organization.id} />
				</Card.Content>
			</Card>

			<Card className="border-destructive/20">
				<Card.Content>
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-start gap-3">
							<div className="flex size-8 items-center justify-center rounded-md bg-destructive/10">
								<Warning className="text-destructive" size={14} weight="fill" />
							</div>
							<div>
								<Text variant="label">
									{isOwner === null
										? "Loading..."
										: isOwner
											? "Delete Organization"
											: "Leave Organization"}
								</Text>
								<Text tone="muted" variant="caption">
									{isOwner === null
										? "Checking permissions..."
										: isOwner
											? "Permanently delete this organization and all data"
											: "You will lose access to all resources"}
								</Text>
							</div>
						</div>
						{isOwner === null ? (
							<Button disabled size="sm" tone="danger">
								Loading
							</Button>
						) : isOwner ? (
							<Button
								onClick={() => setShowDeleteDialog(true)}
								size="sm"
								tone="danger"
							>
								<Trash size={14} />
								Delete
							</Button>
						) : (
							<Button
								onClick={() => setShowLeaveDialog(true)}
								size="sm"
								tone="danger"
							>
								<SignOut size={14} />
								Leave
							</Button>
						)}
					</div>
				</Card.Content>
			</Card>

			<Dialog
				onOpenChange={(open) => {
					setShowDeleteDialog(open);
					if (!open) {
						setConfirmText("");
					}
				}}
				open={showDeleteDialog}
			>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Are you absolutely sure?</Dialog.Title>
						<Dialog.Description>
							This will permanently delete "{organization.name}" and all
							associated data. This action cannot be undone.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Body>
						<Field>
							<Field.Label>Type the organization name to confirm</Field.Label>
							<Input
								onChange={(e) => setConfirmText(e.target.value)}
								placeholder={organization.name}
								value={confirmText}
							/>
							<Field.Description>
								Type{" "}
								<span className="font-medium text-foreground">
									{organization.name}
								</span>{" "}
								to confirm
							</Field.Description>
						</Field>
					</Dialog.Body>
					<Dialog.Footer>
						<Button
							onClick={() => {
								setShowDeleteDialog(false);
								setConfirmText("");
							}}
							variant="secondary"
						>
							Cancel
						</Button>
						<Button
							disabled={confirmText !== organization.name}
							loading={isDeleting}
							onClick={handleDelete}
							tone="danger"
						>
							Delete Organization
						</Button>
					</Dialog.Footer>
					<Dialog.Close />
				</Dialog.Content>
			</Dialog>

			<Dialog onOpenChange={setShowLeaveDialog} open={showLeaveDialog}>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Leave organization?</Dialog.Title>
						<Dialog.Description>
							You will lose access to "{organization.name}" and all its
							resources. This action cannot be undone.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button
							onClick={() => setShowLeaveDialog(false)}
							variant="secondary"
						>
							Cancel
						</Button>
						<Button loading={isLeaving} onClick={handleLeave} tone="danger">
							Leave Organization
						</Button>
					</Dialog.Footer>
					<Dialog.Close />
				</Dialog.Content>
			</Dialog>
		</>
	);
}
