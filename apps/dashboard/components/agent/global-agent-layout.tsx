"use client";

import { cn } from "@/lib/utils";
import { GlobalAgentDock } from "./global-agent-dock";
import { useGlobalAgent } from "./global-agent-provider";

export function GlobalAgentLayout() {
	const { isAvailable, isOpen } = useGlobalAgent();
	const showDock = isAvailable && isOpen;

	return (
		<aside
			aria-label="Databunny agent"
			className={cn(
				"hidden min-h-0 shrink-0 overflow-hidden border-border/60 border-l bg-background transition-[width,opacity] duration-200 ease-out md:flex",
				showDock
					? "w-[28rem] opacity-100 xl:w-[30rem]"
					: "w-0 border-l-0 opacity-0"
			)}
		>
			{showDock ? <GlobalAgentDock /> : null}
		</aside>
	);
}
