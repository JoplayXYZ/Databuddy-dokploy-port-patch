"use client";

import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";
import { ApiKeyCreateDialog } from "@/components/organizations/api-key-create-dialog";
import { ApiKeyDetailDialog } from "@/components/organizations/api-key-detail-dialog";
import type { ApiKeyListItem } from "@/components/organizations/api-key-types";
import type { Organization } from "@/hooks/use-organizations";
import { orpc } from "@/lib/orpc";
import { Key, Plus } from "@phosphor-icons/react/dist/ssr";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiKeyRow } from "./api-key-row";

function ApiKeysSkeleton() {
	return (
		<div className="divide-y">
			{[1, 2, 3].map((n) => (
				<div className="flex items-center gap-3 px-5 py-3" key={n}>
					<Skeleton className="size-2 rounded-full" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-3.5 w-36" />
						<Skeleton className="h-3 w-44" />
					</div>
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="size-3" />
				</div>
			))}
		</div>
	);
}

export function ApiKeysSection({
	organization,
}: {
	organization: Organization;
}) {
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showDetailDialog, setShowDetailDialog] = useState(false);
	const [selectedKey, setSelectedKey] = useState<ApiKeyListItem | null>(null);

	const { data, isLoading } = useQuery({
		...orpc.apikeys.list.queryOptions({
			input: { organizationId: organization.id },
		}),
		refetchOnMount: true,
		staleTime: 0,
	});

	const items = (data ?? []) as ApiKeyListItem[];
	const activeCount = items.filter((k) => k.enabled && !k.revokedAt).length;
	const isEmpty = items.length === 0;

	return (
		<Card>
			<Card.Header className="flex-row items-start justify-between gap-4">
				<div>
					<Card.Title>API Keys</Card.Title>
					<Card.Description>
						{isEmpty
							? "Create keys for programmatic access to your workspace"
							: `${activeCount} active of ${items.length} key${items.length === 1 ? "" : "s"}`}
					</Card.Description>
				</div>
				<Button
					onClick={() => setShowCreateDialog(true)}
					size="sm"
					variant="secondary"
				>
					<Plus size={14} />
					Create Key
				</Button>
			</Card.Header>
			<Card.Content className="p-0">
				{isLoading ? (
					<ApiKeysSkeleton />
				) : isEmpty ? (
					<div className="px-5 py-8">
						<EmptyState
							action={
								<Button onClick={() => setShowCreateDialog(true)} size="sm">
									<Plus size={14} />
									Create your first key
								</Button>
							}
							description="API keys authenticate requests to the Databuddy API. Keys are shown once at creation."
							icon={<Key weight="duotone" />}
							title="No API keys"
						/>
					</div>
				) : (
					<div className="divide-y">
						{items.map((apiKey) => (
							<ApiKeyRow
								apiKey={apiKey}
								key={apiKey.id}
								onSelect={() => {
									setSelectedKey(apiKey);
									setShowDetailDialog(true);
								}}
							/>
						))}
					</div>
				)}
			</Card.Content>

			<ApiKeyCreateDialog
				onOpenChangeAction={setShowCreateDialog}
				onSuccessAction={() => {
					setShowCreateDialog(false);
				}}
				open={showCreateDialog}
				organizationId={organization.id}
			/>
			<ApiKeyDetailDialog
				apiKey={selectedKey}
				onOpenChangeAction={setShowDetailDialog}
				open={showDetailDialog}
			/>
		</Card>
	);
}
