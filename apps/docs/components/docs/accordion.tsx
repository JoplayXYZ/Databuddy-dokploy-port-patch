"use client";

import type * as React from "react";
import { cn } from "@databuddy/ui";
import { Accordion as DSAccordion } from "@databuddy/ui/client";

function Accordion({
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { collapsible?: boolean; type?: string }) {
	return (
		<div className={cn("w-full", className)} {...props}>
			{children}
		</div>
	);
}

function AccordionItem({
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { value: string }) {
	return (
		<DSAccordion
			className={cn("border-border/60 border-b last:border-b-0", className)}
			{...props}
		>
			{children}
		</DSAccordion>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<"button">) {
	return (
		<DSAccordion.Trigger
			className={cn(
				"min-h-10 cursor-pointer px-4 py-2.5 font-medium text-foreground text-sm hover:bg-accent-brighter/60",
				className
			)}
			{...props}
		>
			{children}
		</DSAccordion.Trigger>
	);
}

function AccordionContent({
	className,
	children,
}: React.ComponentProps<"div">) {
	return (
		<DSAccordion.Content
			className={cn(
				"px-4 pt-0 pb-4 text-muted-foreground text-sm leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className
			)}
		>
			{children}
		</DSAccordion.Content>
	);
}

interface AccordionsProps extends React.ComponentProps<"div"> {
	collapsible?: boolean;
	type?: "single" | "multiple";
}

function Accordions({ className, children, ...props }: AccordionsProps) {
	return (
		<div
			className={cn(
				"not-prose my-4 overflow-hidden rounded-lg border border-border/60 bg-card",
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Accordions,
};
