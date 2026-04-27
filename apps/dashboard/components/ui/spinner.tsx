"use client";

import { CircleNotchIcon } from "@databuddy/ui/icons";
import { cn } from "../../lib/utils";

export const Spinner = ({ className }: { className?: string }) => {
	return (
		<CircleNotchIcon
			className={cn("animate-spin text-muted-foreground", className)}
		/>
	);
};
