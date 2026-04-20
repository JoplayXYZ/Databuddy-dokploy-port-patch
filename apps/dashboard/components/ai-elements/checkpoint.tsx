"use client";

import { BookmarkIcon, type LucideProps } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { Button } from "@/components/ds/button";
import { Divider } from "@/components/ds/divider";
import { Tooltip } from "@/components/ds/tooltip";
import { cn } from "@/lib/utils";

export type CheckpointProps = HTMLAttributes<HTMLDivElement>;

export const Checkpoint = ({
	className,
	children,
	...props
}: CheckpointProps) => (
	<div
		className={cn(
			"flex items-center gap-0.5 overflow-hidden text-muted-foreground",
			className
		)}
		{...props}
	>
		{children}
		<Divider />
	</div>
);

export type CheckpointIconProps = LucideProps;

export const CheckpointIcon = ({
	className,
	children,
	...props
}: CheckpointIconProps) =>
	children ?? (
		<BookmarkIcon className={cn("size-4 shrink-0", className)} {...props} />
	);

export type CheckpointTriggerProps = ComponentProps<typeof Button> & {
	tooltip?: string;
};

export const CheckpointTrigger = ({
	children,
	className,
	variant = "ghost",
	size = "sm",
	tooltip,
	...props
}: CheckpointTriggerProps) =>
	tooltip ? (
		<Tooltip content={tooltip} side="bottom">
			<Button size={size} type="button" variant={variant} {...props}>
				{children}
			</Button>
		</Tooltip>
	) : (
		<Button size={size} type="button" variant={variant} {...props}>
			{children}
		</Button>
	);
