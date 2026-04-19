"use client";

import {
	IconAlertWarningFillDuo18,
	IconBoltLightningFillDuo18,
	IconChartBarTrendUpFillDuo18,
	IconClipboardContentFillDuo18,
	IconCompassFillDuo18,
	IconFileContentFillDuo18,
	IconFilterFillDuo18,
	IconMagnifierFillDuo18,
} from "nucleo-ui-fill-duo-18";
hosphor-icons/react";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AgentCommand } from "./agent-commands";

const COMMAND_ICONS: Record<string, typeof IconMagnifierFillDuo18> = {
	"/analyze": IconMagnifierFillDuo18,
	"/sources": IconCompassFillDuo18,
	"/funnel": IconFilterFillDuo18,
	"/pages": IconFileContentFillDuo18,
	"/live": IconBoltLightningFillDuo18,
	"/anomalies": IconAlertWarningFillDuo18,
	"/compare": IconChartBarTrendUpFillDuo18,
	"/report": IconClipboardContentFillDuo18,
};

function getCommandIcon(command: string) {
	return COMMAND_ICONS[command] ?? IconMagnifierFillDuo18;
}

interface AgentCommandMenuProps {
	anchor: React.ReactNode;
	commands: readonly AgentCommand[];
	onDismiss: () => void;
	onHover: (index: number) => void;
	onSelect: (command: AgentCommand) => void;
	open: boolean;
	selectedIndex: number;
}

export function AgentCommandMenu({
	anchor,
	commands,
	onDismiss,
	onHover,
	onSelect,
	open,
	selectedIndex,
}: AgentCommandMenuProps) {
	return (
		<Popover
			onOpenChange={(next) => {
				if (!next) {
					onDismiss();
				}
			}}
			open={open}
		>
			<PopoverAnchor asChild>{anchor}</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-(--radix-popper-anchor-width) overflow-hidden p-0"
				onOpenAutoFocus={(e) => e.preventDefault()}
				side="top"
				sideOffset={8}
			>
				<div className="border-border/60 border-b bg-muted/40 px-3 py-1.5 font-medium text-[10px] text-muted-foreground uppercase">
					Commands
				</div>
				<ul className="max-h-72 overflow-y-auto py-1">
					{commands.map((cmd, idx) => {
						const Icon = getCommandIcon(cmd.command);
						const isSelected = idx === selectedIndex;
						return (
							<li key={cmd.id}>
								<button
									className={cn(
										"flex w-full items-center gap-3 px-2 py-1.5 text-left transition-colors",
										isSelected
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/50"
									)}
									onClick={() => onSelect(cmd)}
									onMouseDown={(e) => e.preventDefault()}
									onMouseEnter={() => onHover(idx)}
									type="button"
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded border bg-background">
										<Icon
											className="size-4 text-foreground/60"
										/>
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm leading-tight">
											{cmd.title}
										</p>
										<p className="truncate text-foreground/50 text-xs leading-snug">
											{cmd.description}
										</p>
									</div>
									<span className="shrink-0 font-mono text-foreground/30 text-xs">
										{cmd.command}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
