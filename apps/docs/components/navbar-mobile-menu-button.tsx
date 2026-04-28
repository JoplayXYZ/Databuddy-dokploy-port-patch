"use client";

import { ListIcon, XIcon } from "@phosphor-icons/react";

interface NavbarMobileMenuButtonProps {
	className?: string;
	isOpen: boolean;
	onToggleAction: () => void;
}

export function NavbarMobileMenuButton({
	className,
	isOpen,
	onToggleAction,
}: NavbarMobileMenuButtonProps) {
	return (
		<button
			aria-label="Toggle mobile menu"
			className={className}
			onClick={onToggleAction}
			type="button"
		>
			{isOpen ? (
				<XIcon className="size-4" weight="bold" />
			) : (
				<ListIcon className="size-4" weight="bold" />
			)}
		</button>
	);
}
