"use client";

import { IconLoader2FillDuo18 } from "nucleo-ui-fill-duo-18";
import { cn } from "../../lib/utils";

export const Spinner = ({ className }: { className?: string }) => {
	return (
		<IconLoader2FillDuo18
			className={cn("animate-spin text-muted-foreground", className)}
		/>
	);
};
