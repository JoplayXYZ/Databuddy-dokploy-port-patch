"use client";

import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
	className,
	...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			className={cn(
				"peer size-4 shrink-0 cursor-pointer overflow-hidden rounded-sm bg-secondary outline-none",
				"transition-[background-color,color,box-shadow,opacity] duration-(--duration-quick) ease-(--ease-smooth)",
				"focus-visible:ring-2 focus-visible:ring-ring/60",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"aria-invalid:ring-2 aria-invalid:ring-destructive/60",
				"data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
				className
			)}
			data-slot="checkbox"
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className="flex items-center justify-center text-current transition-none"
				data-slot="checkbox-indicator"
			>
				<CheckIcon className="size-3.5" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
