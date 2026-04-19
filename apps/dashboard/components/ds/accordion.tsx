"use client";

import { cn } from "@/lib/utils";
import { Collapsible as BaseCollapsible } from "@base-ui-components/react/collapsible";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithoutRef } from "react";

function Root({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BaseCollapsible.Root>) {
	return <BaseCollapsible.Root className={cn(className)} {...rest} />;
}

function Trigger({
	className,
	children,
	...rest
}: ComponentPropsWithoutRef<typeof BaseCollapsible.Trigger>) {
	return (
		<BaseCollapsible.Trigger
			className={cn(
				"group/trigger flex w-full cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-left",
				"transition-colors duration-(--duration-quick) ease-(--ease-smooth)",
				"hover:bg-interactive-hover",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
				"disabled:pointer-events-none disabled:opacity-50",
				className
			)}
			{...rest}
		>
			<CaretDown
				className={cn(
					"size-3 shrink-0 text-muted-foreground",
					"transition-transform duration-(--duration-quick) ease-(--ease-smooth)",
					"group-data-panel-open/trigger:-rotate-180"
				)}
			/>
			<span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
		</BaseCollapsible.Trigger>
	);
}

function Panel({
	className,
	children,
	keepMounted = true,
	...rest
}: ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>) {
	return (
		<BaseCollapsible.Panel
			className={cn(
				"overflow-hidden",
				"h-[--collapsible-panel-height]",
				"transition-[height] duration-200 ease-out",
				"data-ending-style:h-0",
				"data-starting-style:h-0",
				className
			)}
			keepMounted={keepMounted}
			{...rest}
		>
			{children}
		</BaseCollapsible.Panel>
	);
}

function Content({
	className,
	children,
	...rest
}: ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>) {
	return (
		<Panel {...rest}>
			<div
				className={cn("border-border/60 border-t px-3 pt-3 pb-3", className)}
			>
				{children}
			</div>
		</Panel>
	);
}

export const Accordion = Object.assign(Root, {
	Trigger,
	Panel,
	Content,
});
