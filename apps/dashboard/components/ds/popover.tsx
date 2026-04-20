"use client";

import { resolveComposableRender } from "@/components/ds/composable-render";
import { cn } from "@/lib/utils";
import { Popover as BasePopover } from "@base-ui-components/react/popover";
import type { ComponentPropsWithoutRef } from "react";

function Root(props: ComponentPropsWithoutRef<typeof BasePopover.Root>) {
	return <BasePopover.Root {...props} />;
}

function Trigger({
	className,
	children,
	render,
	...rest
}: ComponentPropsWithoutRef<typeof BasePopover.Trigger>) {
	const composed = resolveComposableRender(children, render);

	return (
		<BasePopover.Trigger
			className={composed.render ? className : cn("cursor-pointer", className)}
			render={composed.render}
			{...rest}
		>
			{composed.children}
		</BasePopover.Trigger>
	);
}

function Content({
	className,
	children,
	side = "bottom",
	...rest
}: ComponentPropsWithoutRef<typeof BasePopover.Popup> & {
	side?: ComponentPropsWithoutRef<typeof BasePopover.Positioner>["side"];
}) {
	return (
		<BasePopover.Portal>
			<BasePopover.Positioner className="z-50" side={side} sideOffset={6}>
				<BasePopover.Popup
					className={cn(
						"w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-border/60 bg-popover p-4",
						"transition-[opacity,transform] duration-(--duration-quick) ease-(--ease-smooth)",
						"motion-reduce:transition-none",
						"data-starting-style:scale-95 data-starting-style:opacity-0",
						"data-ending-style:scale-95 data-ending-style:opacity-0",
						"origin-(--transform-origin)",
						className
					)}
					{...rest}
				>
					{children}
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	);
}

function Title({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BasePopover.Title>) {
	return (
		<BasePopover.Title
			className={cn("font-semibold text-foreground text-xs", className)}
			{...rest}
		/>
	);
}

function Description({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BasePopover.Description>) {
	return (
		<BasePopover.Description
			className={cn("text-[11px] text-muted-foreground", className)}
			{...rest}
		/>
	);
}

function Close(props: ComponentPropsWithoutRef<typeof BasePopover.Close>) {
	return <BasePopover.Close {...props} />;
}

export const Popover: typeof Root & {
	Close: typeof Close;
	Content: typeof Content;
	Description: typeof Description;
	Title: typeof Title;
	Trigger: typeof Trigger;
} = Object.assign(Root, {
	Trigger,
	Content,
	Title,
	Description,
	Close,
});

export const PopoverTrigger = Trigger;
export const PopoverContent = Content;
