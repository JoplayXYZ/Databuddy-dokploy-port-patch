"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";
import type { ReactNode } from "react";

interface SegmentedControlOption<T extends string> {
	label: ReactNode;
	value: T;
}

interface SegmentedControlProps<T extends string> {
	className?: string;
	disabled?: boolean;
	name?: string;
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
	name,
}: SegmentedControlProps<T>) {
	const generatedName = useId();
	const groupName = name ?? generatedName;

	return (
		<div
			className={cn(
				"inline-flex items-center rounded-md bg-secondary p-1",
				size === "sm" ? "gap-0.5" : "gap-1",
				disabled && "pointer-events-none opacity-50",
				className
			)}
			role="radiogroup"
		>
			{options.map((option) => {
				const isSelected = option.value === value;

				return (
					<label
						className={cn(
							"relative flex cursor-pointer items-center justify-center rounded font-medium",
							"transition-colors duration-(--duration-quick) ease-(--ease-smooth)",
							"focus-within:ring-2 focus-within:ring-ring/60",
							size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
							isSelected
								? variant === "pill"
									? "bg-primary text-primary-foreground shadow-sm"
									: "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						)}
						key={option.value}
					>
						<input
							checked={isSelected}
							className="sr-only"
							disabled={disabled}
							name={groupName}
							onChange={() => onChange(option.value)}
							type="radio"
							value={option.value}
						/>
						{option.label}
					</label>
				);
			})}
		</div>
	);
}

export { SegmentedControl };
export type { SegmentedControlOption, SegmentedControlProps };
