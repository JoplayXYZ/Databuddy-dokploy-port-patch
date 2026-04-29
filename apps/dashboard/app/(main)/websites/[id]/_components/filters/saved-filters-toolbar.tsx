"use client";

import type { DynamicQueryFilter } from "@databuddy/shared/types/api";
import { useAtom, useSetAtom } from "jotai";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import {
	dynamicQueryFiltersAtom,
	editingSavedFilterAtom,
} from "@/stores/jotai/filterAtoms";
import { SavedFiltersMenu } from "./saved-filters-menu";
import { DeleteDialog } from "@databuddy/ui/client";

export function SavedFiltersToolbar() {
	const [filters, setFilters] = useAtom(dynamicQueryFiltersAtom);
	const setEditing = useSetAtom(editingSavedFilterAtom);
	const { id } = useParams();
	const websiteId = id as string;

	const {
		savedFilters,
		isLoading,
		deleteFilter,
		duplicateFilter,
		deleteAllFilters,
	} = useSavedFilters(websiteId);

	const [deleteDialog, setDeleteDialog] = useState({
		isOpen: false,
		filterId: "",
		filterName: "",
	});
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
	const [isDeletingAll, setIsDeletingAll] = useState(false);

	const handleApply = useCallback(
		(appliedFilters: DynamicQueryFilter[]) => {
			setEditing(null);
			setFilters(appliedFilters);
		},
		[setFilters, setEditing]
	);

	const handleEdit = useCallback(
		(id: string) => {
			const filter = savedFilters.find((f) => f.id === id);
			if (filter) {
				setFilters(filter.filters);
				setEditing({
					id: filter.id,
					name: filter.name,
					originalFilters: [...filter.filters],
				});
			}
		},
		[savedFilters, setFilters, setEditing]
	);

	const handleDeleteSaved = useCallback(
		(id: string) => {
			const filter = savedFilters.find((f) => f.id === id);
			if (filter) {
				setDeleteDialog({
					isOpen: true,
					filterId: id,
					filterName: filter.name,
				});
			}
		},
		[savedFilters]
	);

	const handleConfirmDelete = useCallback(() => {
		setIsDeleting(true);
		const result = deleteFilter(deleteDialog.filterId);
		if (result.success) {
			setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
		}
		setIsDeleting(false);
	}, [deleteFilter, deleteDialog.filterId]);

	const handleDuplicate = useCallback(
		(id: string) => duplicateFilter(id),
		[duplicateFilter]
	);

	const handleDeleteAll = useCallback(() => setIsDeleteAllOpen(true), []);

	const handleConfirmDeleteAll = useCallback(() => {
		setIsDeletingAll(true);
		deleteAllFilters();
		setIsDeleteAllOpen(false);
		setIsDeletingAll(false);
	}, [deleteAllFilters]);

	if (isLoading || savedFilters.length === 0) {
		return null;
	}

	return (
		<>
			<SavedFiltersMenu
				currentFilters={filters}
				isLoading={isLoading}
				onApplyFilter={handleApply}
				onDeleteAll={handleDeleteAll}
				onDeleteFilter={handleDeleteSaved}
				onDuplicateFilter={handleDuplicate}
				onEditFilter={handleEdit}
				savedFilters={savedFilters}
			/>

			<DeleteDialog
				confirmLabel="Delete"
				description={`Are you sure you want to delete "${deleteDialog.filterName}"? This action cannot be undone and the filter configuration will be permanently removed.`}
				isDeleting={isDeleting}
				isOpen={deleteDialog.isOpen}
				onClose={() =>
					setDeleteDialog((prev) => ({ ...prev, isOpen: false }))
				}
				onConfirm={handleConfirmDelete}
				title="Delete Saved Filter"
			/>

			<DeleteDialog
				confirmLabel="Delete All"
				description={`Are you sure you want to delete all ${savedFilters.length} saved filter${savedFilters.length === 1 ? "" : "s"}? This will permanently remove all your saved filter configurations and cannot be undone.`}
				isDeleting={isDeletingAll}
				isOpen={isDeleteAllOpen}
				onClose={() => setIsDeleteAllOpen(false)}
				onConfirm={handleConfirmDeleteAll}
				title="Delete All Saved Filters"
			/>
		</>
	);
}
