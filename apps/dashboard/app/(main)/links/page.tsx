"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import {
	type Link,
	useCreateLinkFolder,
	useDeleteLink,
	useLinkFolders,
	useLinks,
} from "@/hooks/use-links";
import { useFlags } from "@databuddy/sdk/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeepLinkSheet } from "./_components/deep-link-sheet";
import { LinkFolderSheet } from "./_components/link-folder-sheet";
import { LinkFoldersList } from "./_components/link-folders-list";
import {
	LinksListSkeleton,
	LinksSearchBarSkeleton,
	LinksList,
} from "./_components/link-item";
import { LinkSheet } from "./_components/link-sheet";
import { LinksSearchBar } from "./_components/links-search-bar";
import { QrCodeDialog } from "./_components/qr-code-dialog";
import {
	type SortOption,
	type TypeFilter,
	useFilteredLinks,
} from "./_components/use-filtered-links";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import {
	ArchiveIcon,
	LinkIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	RocketIcon,
} from "@databuddy/ui/icons";
import { Button, Card, EmptyState } from "@databuddy/ui";
import { DeleteDialog, DropdownMenu } from "@databuddy/ui/client";

export default function LinksPage() {
	const [sheetLink, setSheetLink] = useState<Link | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [qrLink, setQrLink] = useState<Link | null>(null);
	const [isDeepLinkSheetOpen, setIsDeepLinkSheetOpen] = useState(false);
	const [isFolderSheetOpen, setIsFolderSheetOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortOption>("newest");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

	const { isOn } = useFlags();
	const deepLinksEnabled = isOn("deeplinks");
	const { links, isLoading, isError, isFetching, refetch } = useLinks();
	const { folders } = useLinkFolders();
	const createFolder = useCreateLinkFolder();
	const deleteLink = useDeleteLink();
	const filtered = useFilteredLinks(links, search, sort, typeFilter);
	const foldersById = useMemo(
		() => new Map(folders.map((folder) => [folder.id, folder.name])),
		[folders]
	);
	const hasDeepLinks = links.some((l) => !!l.deepLinkApp);

	const busy = isLoading || isFetching;
	const hasLinks = links.length > 0;
	const hasFolders = folders.length > 0;
	const noResults = !busy && hasLinks && filtered.length === 0;

	const openCreate = useCallback(() => {
		setSheetLink(null);
		setIsSheetOpen(true);
	}, []);

	const openEdit = useCallback((link: Link) => {
		setSheetLink(link);
		setIsSheetOpen(true);
	}, []);

	const closeSheet = useCallback(() => {
		setIsSheetOpen(false);
		setSheetLink(null);
	}, []);

	const handleDelete = async (id: string) => {
		try {
			await deleteLink.mutateAsync({ id });
			setDeleteId(null);
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete link"
			);
		}
	};

	const handleCreateFolder = async (name: string) => {
		try {
			await createFolder.mutateAsync({ name });
			setIsFolderSheetOpen(false);
			toast.success("Folder created");
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create folder"
			);
		}
	};

	return (
		<ErrorBoundary>
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-6 p-5">
					<Card>
						<Card.Header className="flex-row items-start justify-between gap-4">
							<div>
								<Card.Title>Links</Card.Title>
								<Card.Description>
									{hasLinks
										? `${links.length} link${links.length === 1 ? "" : "s"}`
										: "Create and manage short links with analytics"}
								</Card.Description>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<Button
									onClick={() => setIsFolderSheetOpen(true)}
									size="sm"
									variant="secondary"
								>
									<ArchiveIcon className="size-3.5" weight="duotone" />
									Folder
								</Button>
								{deepLinksEnabled ? (
									<DropdownMenu>
										<DropdownMenu.Trigger className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90">
											<PlusIcon size={14} />
											New Link
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" className="w-44">
											<DropdownMenu.Item className="gap-2" onClick={openCreate}>
												<LinkSimpleIcon className="size-4" weight="duotone" />
												Short Link
											</DropdownMenu.Item>
											<DropdownMenu.Item
												className="gap-2"
												onClick={() => setIsDeepLinkSheetOpen(true)}
											>
												<RocketIcon className="size-4" weight="duotone" />
												Deep Link
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu>
								) : (
									<Button onClick={openCreate} size="sm">
										<PlusIcon size={14} />
										New Link
									</Button>
								)}
							</div>
						</Card.Header>
						<Card.Content className="p-0">
							{busy ? (
								<>
									<LinksSearchBarSkeleton />
									<LinksListSkeleton />
								</>
							) : hasLinks || hasFolders ? (
								<>
									{hasLinks && (
										<div className="border-b px-4 py-2">
											<LinksSearchBar
												hasDeepLinks={hasDeepLinks}
												onSearchQueryChangeAction={setSearch}
												onSortByChangeAction={setSort}
												onTypeFilterChangeAction={setTypeFilter}
												searchQuery={search}
												sortBy={sort}
												typeFilter={typeFilter}
											/>
										</div>
									)}
									{noResults ? (
										<div className="px-5 py-12">
											<EmptyState
												description={`No links match \u201c${search}\u201d`}
												icon={<MagnifyingGlassIcon weight="duotone" />}
												title="No results"
												variant="minimal"
											/>
										</div>
									) : (
										<LinkFoldersList
											folders={folders}
											foldersById={foldersById}
											links={filtered}
											onCreateLink={openCreate}
											onDelete={setDeleteId}
											onEdit={openEdit}
											onShowQr={setQrLink}
										/>
									)}
								</>
							) : isError ? (
								<div className="px-5 py-12">
									<EmptyState
										action={{
											label: "Retry",
											onClick: () => refetch(),
										}}
										description="There was an issue fetching your links. Please try again."
										icon={<LinkIcon weight="duotone" />}
										title="Error loading links"
										variant="error"
									/>
								</div>
							) : (
								<LinksList
									foldersById={foldersById}
									links={[]}
									onCreateLink={openCreate}
									onDelete={setDeleteId}
									onEdit={openEdit}
									onShowQr={setQrLink}
								/>
							)}
						</Card.Content>
					</Card>
				</div>
			</div>

			<LinkSheet
				link={sheetLink}
				onOpenChange={(open) => (open ? setIsSheetOpen(true) : closeSheet())}
				open={isSheetOpen}
			/>

			<DeepLinkSheet
				onOpenChange={setIsDeepLinkSheetOpen}
				open={isDeepLinkSheetOpen}
			/>

			<LinkFolderSheet
				isCreating={createFolder.isPending}
				onCreate={handleCreateFolder}
				onOpenChange={setIsFolderSheetOpen}
				open={isFolderSheetOpen}
			/>

			<QrCodeDialog
				link={qrLink}
				onOpenChange={(open) => {
					if (!open) {
						setQrLink(null);
					}
				}}
				open={!!qrLink}
			/>

			{deleteId && (
				<DeleteDialog
					confirmLabel="Delete Link"
					description="Are you sure you want to delete this link? This action cannot be undone and will permanently remove all click data."
					isDeleting={deleteLink.isPending}
					isOpen={!!deleteId}
					onClose={() => setDeleteId(null)}
					onConfirm={() => handleDelete(deleteId)}
					title="Delete Link"
				/>
			)}
		</ErrorBoundary>
	);
}
