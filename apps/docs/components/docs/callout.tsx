import {
	CheckCircleIcon,
	InfoIcon,
	LightbulbIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@databuddy/ui/icons";
import { cn } from "@databuddy/ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const calloutVariants = cva(
	"not-prose my-4 flex gap-3 rounded-lg border border-border/60 bg-card p-3.5 text-card-foreground",
	{
		variants: {
			type: {
				info: "",
				success: "",
				warn: "",
				error: "border-destructive/30",
				tip: "",
				note: "",
			},
		},
		defaultVariants: {
			type: "info",
		},
	}
);

const iconShellVariants = cva(
	"flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground",
	{
		variants: {
			type: {
				info: "",
				success: "text-success",
				warn: "text-warning",
				error: "bg-destructive/10 text-destructive",
				tip: "text-brand-purple",
				note: "",
			},
		},
		defaultVariants: {
			type: "info",
		},
	}
);

const titleVariants = cva("font-medium text-foreground text-sm", {
	variants: {
		type: {
			info: "",
			success: "",
			warn: "",
			error: "text-destructive",
			tip: "",
			note: "",
		},
	},
	defaultVariants: {
		type: "info",
	},
});

const iconMap = {
	info: InfoIcon,
	success: CheckCircleIcon,
	warn: WarningCircleIcon,
	error: XCircleIcon,
	tip: LightbulbIcon,
	note: InfoIcon,
};

interface CalloutProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof calloutVariants> {
	title?: string;
}

function Callout({
	className,
	type = "info",
	title,
	children,
	...props
}: CalloutProps) {
	const Icon = iconMap[type as keyof typeof iconMap] || iconMap.info;
	const hasTitle = !!title;

	return (
		<div
			className={cn(
				calloutVariants({ type }),
				hasTitle ? "items-start" : "items-center",
				className
			)}
			role="alert"
			{...props}
		>
			<div className={cn(iconShellVariants({ type }))}>
				<Icon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				{title && <div className={cn(titleVariants({ type }))}>{title}</div>}
				<div
					className={cn(
						"text-muted-foreground text-sm leading-6 [&_p:not(:first-child)]:mt-2 [&_p]:m-0",
						!hasTitle && "flex min-h-8 items-center"
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

export { Callout };
