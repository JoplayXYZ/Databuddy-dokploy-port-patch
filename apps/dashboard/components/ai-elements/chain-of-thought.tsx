"use client";

import {
	IconCircleCheckFillDuo18,
	IconLoader2FillDuo18,
} from "nucleo-ui-fill-duo-18";
import type { ComponentProps, ReactNode } from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

export type ToolStepProps = ComponentProps<"div"> & {
	label: ReactNode;
	status?: "complete" | "active";
};

export const ToolStep = memo(
	({ className, label, status = "complete", ...props }: ToolStepProps) => (
		<div
			className={cn(
				"flex items-center gap-2 py-0.5 text-muted-foreground text-xs",
				status === "active" && "text-foreground",
				className
			)}
			{...props}
		>
			{status === "complete" ? (
				<IconCircleCheckFillDuo18
					className="size-3 shrink-0 text-muted-foreground/60"
				/>
			) : (
				<IconLoader2FillDuo18
					className="size-3 shrink-0 animate-spin"
				/>
			)}
			<span>{label}</span>
		</div>
	)
);

ToolStep.displayName = "ToolStep";
