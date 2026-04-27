import type * as React from "react";
import { cn } from "@databuddy/ui";

function Table({
	children,
	className,
	...props
}: React.ComponentProps<"table">) {
	return (
		<div className="not-prose my-4 w-full overflow-hidden rounded-lg border border-border/60 bg-card">
			<div className="w-full overflow-x-auto">
				<table
					className={cn(
						"w-full border-collapse bg-card text-card-foreground text-sm",
						className
					)}
					{...props}
				>
					{children}
				</table>
			</div>
		</div>
	);
}

function TableHeader({
	children,
	className,
	...props
}: React.ComponentProps<"thead">) {
	return (
		<thead className={cn("bg-secondary/50", className)} {...props}>
			{children}
		</thead>
	);
}

function TableBody({
	children,
	className,
	...props
}: React.ComponentProps<"tbody">) {
	return (
		<tbody className={className} {...props}>
			{children}
		</tbody>
	);
}

function TableRow({
	children,
	className,
	...props
}: React.ComponentProps<"tr">) {
	return (
		<tr
			className={cn("border-border/60 border-b last:border-b-0", className)}
			{...props}
		>
			{children}
		</tr>
	);
}

function TableHead({
	children,
	className,
	...props
}: React.ComponentProps<"th">) {
	return (
		<th
			className={cn(
				"h-10 px-4 text-left font-medium text-muted-foreground text-xs",
				className
			)}
			{...props}
		>
			{children}
		</th>
	);
}

function TableCell({
	children,
	className,
	...props
}: React.ComponentProps<"td">) {
	return (
		<td
			className={cn("px-4 py-3 text-foreground text-sm leading-5", className)}
			{...props}
		>
			{children}
		</td>
	);
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
