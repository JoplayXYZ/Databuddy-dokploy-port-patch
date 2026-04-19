"use client";

import { TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ds/button";
import { Dialog } from "@/components/ds/dialog";

interface DeleteDialogProps {
	cancelLabel?: string;
	children?: React.ReactNode;
	confirmDisabled?: boolean;
	confirmLabel?: string;
	description?: string;
	isDeleting?: boolean;
	isOpen: boolean;
	itemName?: string;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
}

export function DeleteDialog({
	isOpen,
	onClose,
	onConfirm,
	title = "Delete",
	description,
	itemName,
	confirmLabel = "Delete",
	cancelLabel = "Cancel",
	isDeleting = false,
	confirmDisabled = false,
	children,
}: DeleteDialogProps) {
	const wasDeletingRef = useRef(false);

	useEffect(() => {
		if (wasDeletingRef.current && !isDeleting) {
			onClose();
		}
		wasDeletingRef.current = isDeleting;
	}, [isDeleting, onClose]);

	const defaultDescription = itemName
		? `Are you sure you want to delete ${itemName}? This action cannot be undone and will permanently remove it.`
		: "Are you sure you want to delete this item? This action cannot be undone and will permanently remove it.";

	const handleConfirm = () => {
		onConfirm();
	};

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>{title}</Dialog.Title>
					<Dialog.Description>
						{description || defaultDescription}
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Body>
					{children ? (
						<div className="flex flex-col gap-4">
							{children}
							<div className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
								<div className="flex size-8 shrink-0 items-center justify-center">
									<TrashIcon
										className="size-4 text-destructive"
										weight="duotone"
									/>
								</div>
								<p className="text-foreground text-sm">
									This action cannot be undone.
								</p>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-3 py-2">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
								<TrashIcon
									className="size-4.5 text-destructive"
									weight="duotone"
								/>
							</div>
							<p className="text-foreground text-sm">
								This action cannot be undone.
							</p>
						</div>
					)}
				</Dialog.Body>
				<Dialog.Footer>
					<Button disabled={isDeleting} onClick={onClose} variant="secondary">
						{cancelLabel}
					</Button>
					<Button
						disabled={confirmDisabled}
						loading={isDeleting}
						onClick={handleConfirm}
						tone="danger"
					>
						{confirmLabel}
					</Button>
				</Dialog.Footer>
				<Dialog.Close />
			</Dialog.Content>
		</Dialog>
	);
}
