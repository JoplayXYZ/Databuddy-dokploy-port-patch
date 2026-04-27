import type * as React from "react";
import { cn } from "@databuddy/ui";

function Heading1({
	children,
	className,
	...props
}: React.ComponentProps<"h1">) {
	return (
		<h1
			className={cn(
				"mt-8 mb-4 font-semibold text-3xl text-foreground tracking-tight sm:text-4xl",
				className
			)}
			{...props}
		>
			{children}
		</h1>
	);
}

function Heading2({
	children,
	className,
	...props
}: React.ComponentProps<"h2">) {
	return (
		<h2
			className={cn(
				"mt-8 mb-3 font-semibold text-2xl text-foreground tracking-tight sm:text-3xl",
				className
			)}
			{...props}
		>
			{children}
		</h2>
	);
}

function Heading3({
	children,
	className,
	...props
}: React.ComponentProps<"h3">) {
	return (
		<h3
			className={cn(
				"mt-6 mb-2 font-semibold text-foreground text-xl tracking-tight sm:text-2xl",
				className
			)}
			{...props}
		>
			{children}
		</h3>
	);
}

function Blockquote({
	children,
	className,
	...props
}: React.ComponentProps<"blockquote">) {
	return (
		<blockquote
			className={cn(
				"my-4 border-border border-l-2 pl-4 text-muted-foreground [&_p]:m-0 [&_p]:leading-7",
				className
			)}
			{...props}
		>
			{children}
		</blockquote>
	);
}

function Anchor({ children, className, ...props }: React.ComponentProps<"a">) {
	return (
		<a
			className={cn(
				"cursor-pointer font-medium text-primary underline underline-offset-4",
				className
			)}
			{...props}
		>
			{children}
		</a>
	);
}

function HorizontalRule({ className, ...props }: React.ComponentProps<"hr">) {
	return (
		<hr className={cn("my-8 border-border border-t", className)} {...props} />
	);
}

function UnorderedList({
	children,
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			className={cn(
				"my-4 ml-6 list-disc space-y-2 text-foreground/90",
				className
			)}
			{...props}
		>
			{children}
		</ul>
	);
}

function OrderedList({
	children,
	className,
	...props
}: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn(
				"my-4 ml-6 list-decimal space-y-2 text-foreground/90",
				className
			)}
			{...props}
		>
			{children}
		</ol>
	);
}

function ListItem({
	children,
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li className={cn("leading-relaxed", className)} {...props}>
			{children}
		</li>
	);
}

export {
	Anchor,
	Blockquote,
	Heading1,
	Heading2,
	Heading3,
	HorizontalRule,
	ListItem,
	OrderedList,
	UnorderedList,
};
