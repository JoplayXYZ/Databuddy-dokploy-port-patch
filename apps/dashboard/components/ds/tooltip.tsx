"use client";

import { cn } from "@/lib/utils";
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type TooltipProps = ComponentPropsWithoutRef<typeof BaseTooltip.Root> & {
	content: ReactNode;
	children: ReactNode;
	side?: ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>["side"];
};

export function Tooltip({
	content,
	children,
	side = "top",
	...rest
}: TooltipProps) {
	return (
		<BaseTooltip.Provider>
			<BaseTooltip.Root {...rest}>
				<BaseTooltip.Trigger
					render={children as React.ReactElement<Record<string, unknown>>}
				/>
				<BaseTooltip.Portal>
					<BaseTooltip.Positioner side={side} sideOffset={6}>
						<BaseTooltip.Popup
							className={cn(
								"z-50 rounded-md bg-foreground px-2.5 py-1 text-background text-xs",
								"transition-all duration-(--duration-instant) ease-(--ease-smooth)",
								"data-starting-style:scale-95 data-starting-style:opacity-0",
								"data-ending-style:scale-95 data-ending-style:opacity-0",
								"origin-(--transform-origin)"
							)}
						>
							{content}
						</BaseTooltip.Popup>
					</BaseTooltip.Positioner>
				</BaseTooltip.Portal>
			</BaseTooltip.Root>
		</BaseTooltip.Provider>
	);
}
