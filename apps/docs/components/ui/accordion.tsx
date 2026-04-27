"use client";

import { PlusIcon } from "@databuddy/ui/icons";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Accordion({
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			className={cn("border-border/60 border-b last:border-b-0", className)}
			data-slot="accordion-item"
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				className={cn(
					"group flex min-h-10 flex-1 items-center justify-between gap-3 px-4 py-2.5 text-left font-medium text-foreground text-sm outline-none transition-colors hover:bg-accent-brighter/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50",
					className
				)}
				data-slot="accordion-trigger"
				{...props}
			>
				<span className="min-w-0 flex-1">{children}</span>
				<PlusIcon
					className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-45"
					strokeWidth={1.5}
				/>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			className="overflow-hidden text-muted-foreground text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
			data-slot="accordion-content"
			{...props}
		>
			<div
				className={cn(
					"px-4 pt-0 pb-4 leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
					className
				)}
			>
				{children}
			</div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
