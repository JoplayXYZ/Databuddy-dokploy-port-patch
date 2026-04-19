"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SegmentedControlOption<T extends string> {
	label: ReactNode;
	value: T;
}

interface SegmentedControlProps<T extends string> {
	className?: string;
	disabled?: boolean;
	onChange: (value: T) => void;
	options: SegmentedControlOption<T>[];
	size?: "sm" | "md";
	value: T;
	variant?: "default" | "pill";
}

function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	size = "md",
	variant = "default",
	className,
	disabled = false,
}: SegmentedControlProps<T>) {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-0.5 rounded",
				variant === "default" && "border p-0.5",
				variant === "pill" && "bg-secondary p-0.5",
				size === "sm" ? "h-7" : "h-8",
				disabled && "pointer-events-none opacity-50",
				className
			)}
			role="radiogroup"
		>
			{options.map((option) => {
				const isSelected = option.value === value;

				return (
					<button
						aria-checked={isSelected}
						className={cn(
							"relative flex items-center justify-center rounded px-2.5 font-medium",
							"transition-colors duration-(--duration-quick) ease-(--ease-smooth)",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
							size === "sm" ? "h-5 text-xs" : "h-6 text-xs",
							variant === "default" &&
								(isSelected
									? "bg-secondary text-foreground"
									: "text-muted-foreground hover:text-foreground"),
							variant === "pill" &&
								(isSelected
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground")
						)}
						disabled={disabled}
						key={option.value}
						onClick={() => onChange(option.value)}
						role="radio"
						type="button"
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

export { SegmentedControl };
export type { SegmentedControlOption, SegmentedControlProps };
