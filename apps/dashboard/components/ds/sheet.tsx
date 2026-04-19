"use client";

import { cn } from "@/lib/utils";
import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithoutRef } from "react";

type Side = "left" | "right";

function Root(props: ComponentPropsWithoutRef<typeof BaseDialog.Root>) {
	return <BaseDialog.Root {...props} />;
}

function Trigger(props: ComponentPropsWithoutRef<typeof BaseDialog.Trigger>) {
	return <BaseDialog.Trigger {...props} />;
}

const sideStyles: Record<Side, string> = {
	right:
		"right-2 data-starting-style:translate-x-[calc(100%+0.5rem)] data-ending-style:translate-x-[calc(100%+0.5rem)]",
	left: "left-2 data-starting-style:-translate-x-[calc(100%+0.5rem)] data-ending-style:-translate-x-[calc(100%+0.5rem)]",
};

function Content({
	className,
	children,
	side = "right",
	...rest
}: ComponentPropsWithoutRef<typeof BaseDialog.Popup> & { side?: Side }) {
	return (
		<BaseDialog.Portal>
			<BaseDialog.Backdrop
				className={cn(
					"fixed inset-0 z-50 bg-black/40",
					"transition-opacity duration-(--duration-quick) ease-(--ease-smooth)",
					"data-starting-style:opacity-0",
					"data-ending-style:opacity-0"
				)}
			/>
			<BaseDialog.Popup
				className={cn(
					"fixed top-2 bottom-2 z-50 flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg",
					"transition-transform duration-(--duration-base) ease-(--ease-smooth)",
					sideStyles[side],
					className
				)}
				{...rest}
			>
				{children}
			</BaseDialog.Popup>
		</BaseDialog.Portal>
	);
}

function Header({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex shrink-0 flex-col gap-1 bg-muted px-5 py-4",
				className
			)}
			{...rest}
		/>
	);
}

function Body({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex-1 overflow-y-auto px-5 py-4", className)}
			{...rest}
		/>
	);
}

function Footer({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-end gap-2 border-border/60 border-t bg-muted px-5 py-3",
				className
			)}
			{...rest}
		/>
	);
}

function Title({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BaseDialog.Title>) {
	return (
		<BaseDialog.Title
			className={cn("font-semibold text-foreground text-xs", className)}
			{...rest}
		/>
	);
}

function Description({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BaseDialog.Description>) {
	return (
		<BaseDialog.Description
			className={cn("text-muted-foreground text-xs", className)}
			{...rest}
		/>
	);
}

function Close({
	className,
	children,
	...rest
}: ComponentPropsWithoutRef<typeof BaseDialog.Close>) {
	if (children) {
		return (
			<BaseDialog.Close
				render={children as React.ReactElement<Record<string, unknown>>}
				{...rest}
			/>
		);
	}
	return (
		<BaseDialog.Close
			className={cn(
				"absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground",
				"transition-colors duration-(--duration-instant) ease-(--ease-smooth)",
				"hover:bg-interactive-hover hover:text-foreground",
				className
			)}
			{...rest}
		>
			<XIcon className="size-3.5" />
		</BaseDialog.Close>
	);
}

export const Sheet = Object.assign(Root, {
	Trigger,
	Content,
	Header,
	Body,
	Footer,
	Title,
	Description,
	Close,
});
