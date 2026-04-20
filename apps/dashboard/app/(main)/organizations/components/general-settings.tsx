"use client";

import { Check, Copy, FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Divider } from "@/components/ds/divider";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Text } from "@/components/ds/text";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { type Organization, useOrganizations } from "@/hooks/use-organizations";
import { ApiKeysSection } from "./api-keys-section";
import { DangerZoneSection } from "./danger-zone-section";
import { OrganizationAvatarEditor } from "./organization-avatar-editor";
import { WorkspaceWebsitesSection } from "./workspace-websites-section";

export function GeneralSettings({
	organization,
}: {
	organization: Organization;
}) {
	const [name, setName] = useState(organization.name);
	const [slug, setSlug] = useState(organization.slug);
	const [isSaving, setIsSaving] = useState(false);

	const { updateOrganization } = useOrganizations();
	const { isCopied: copiedOrgId, copyToClipboard: copyOrgId } =
		useCopyToClipboard({
			onCopy: () => toast.success("Copied to clipboard"),
		});

	useEffect(() => {
		setName(organization.name);
		setSlug(organization.slug);
	}, [organization.name, organization.slug]);

	const cleanSlug = (value: string) =>
		value
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");

	const handleSlugChange = (value: string) => {
		setSlug(cleanSlug(value));
	};

	const hasChanges = name !== organization.name || slug !== organization.slug;

	const handleSave = () => {
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!slug.trim()) {
			toast.error("Slug is required");
			return;
		}

		setIsSaving(true);
		updateOrganization(
			{
				organizationId: organization.id,
				data: { name: name.trim(), slug: slug.trim() },
			},
			{
				onSuccess: () => {
					setIsSaving(false);
				},
				onError: () => {
					setIsSaving(false);
				},
			}
		);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-6 p-5">
					<Card>
						<Card.Header>
							<Card.Title>Avatar</Card.Title>
							<Card.Description>
								Customize your workspace avatar
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<OrganizationAvatarEditor organization={organization} />
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>Details</Card.Title>
							<Card.Description>
								Name, slug, and workspace identifier
							</Card.Description>
						</Card.Header>
						<Card.Content className="space-y-4">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1 space-y-1">
									<Text variant="label">Workspace ID</Text>
									<Text mono tone="muted" variant="caption">
										{organization.id}
									</Text>
								</div>
								<Button
									onClick={() => copyOrgId(organization.id)}
									size="sm"
									variant={copiedOrgId ? "primary" : "secondary"}
								>
									{copiedOrgId ? (
										<Check className="size-3.5" weight="bold" />
									) : (
										<Copy className="size-3.5" />
									)}
									{copiedOrgId ? "Copied" : "Copy"}
								</Button>
							</div>

							<Divider />

							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<Field.Label>Name</Field.Label>
									<Input
										onChange={(e) => setName(e.target.value)}
										placeholder="e.g., Acme Corporation"
										value={name}
									/>
									<Field.Description>
										Display name for your workspace
									</Field.Description>
								</Field>

								<Field>
									<Field.Label>Slug</Field.Label>
									<Input
										onChange={(e) => handleSlugChange(e.target.value)}
										placeholder="e.g., acme-corp"
										value={slug}
									/>
									<Field.Description>
										Used in URLs:{" "}
										<code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground text-xs">
											/{slug}
										</code>
									</Field.Description>
								</Field>
							</div>
						</Card.Content>
					</Card>

					<WorkspaceWebsitesSection organization={organization} />

					<ApiKeysSection organization={organization} />

					<DangerZoneSection organization={organization} />
				</div>
			</div>

			{hasChanges && (
				<div className="angled-rectangle-gradient flex shrink-0 items-center justify-between border-t bg-muted px-5 py-3">
					<Text tone="muted" variant="caption">
						You have unsaved changes
					</Text>
					<Button loading={isSaving} onClick={handleSave} size="sm">
						<FloppyDisk className="size-3.5" />
						{isSaving ? "Saving…" : "Save Changes"}
					</Button>
				</div>
			)}
		</div>
	);
}
