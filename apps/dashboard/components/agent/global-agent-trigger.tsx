"use client";

import { Button } from "@/components/ds/button";
import { Tooltip } from "@databuddy/ui";
import { RobotIcon } from "@databuddy/ui/icons";
import { cn } from "@/lib/utils";
import { useGlobalAgent } from "./global-agent-provider";

export function GlobalAgentTrigger() {
	const { isAvailable, isOpen, toggleDock } = useGlobalAgent();

	if (!isAvailable) {
		return null;
	}

	return (
		<Tooltip
			content={isOpen ? "Hide Databunny" : "Ask Databunny"}
			side="bottom"
		>
			<Button
				aria-label={isOpen ? "Hide Databunny" : "Ask Databunny"}
				aria-pressed={isOpen}
				className={cn(
					"h-8 min-w-9 justify-start gap-2 px-2.5 text-sidebar-foreground/65 hover:text-sidebar-foreground xl:min-w-20",
					isOpen && "bg-sidebar-accent text-sidebar-foreground"
				)}
				onClick={toggleDock}
				size="sm"
				variant="secondary"
			>
				<RobotIcon className="size-4" />
				<span className="hidden text-xs xl:inline">Ask</span>
			</Button>
		</Tooltip>
	);
}
