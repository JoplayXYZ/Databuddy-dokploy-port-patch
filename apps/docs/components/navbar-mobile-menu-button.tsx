"use client";

import { ListIcon, XMarkIcon } from "@databuddy/ui/icons";
import { cn } from "@databuddy/ui";

interface NavbarMobileMenuButtonProps {
	isOpen: boolean;
	onToggleAction: () => void;
}

const iconBase = "absolute inset-0 size-6 transition-all duration-300 ease-out";

export function NavbarMobileMenuButton({
	isOpen,
	onToggleAction,
}: NavbarMobileMenuButtonProps) {
	return (
		<button
			aria-label="Toggle mobile menu"
			className="group relative cursor-pointer rounded-md p-2.5 text-muted-foreground transition-colors duration-(--duration-quick) ease-(--ease-smooth) hover:bg-interactive-hover hover:text-foreground md:hidden"
			onClick={onToggleAction}
			type="button"
		>
			<div className="relative size-6">
				<ListIcon
					className={cn(
						iconBase,
						isOpen
							? "rotate-90 scale-90 opacity-0"
							: "rotate-0 scale-100 opacity-100"
					)}
				/>
				<XMarkIcon
					className={cn(
						iconBase,
						isOpen
							? "rotate-0 scale-100 opacity-100"
							: "-rotate-90 scale-90 opacity-0"
					)}
				/>
			</div>
		</button>
	);
}
