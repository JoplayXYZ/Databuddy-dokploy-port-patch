"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { CircleIcon } from "@phosphor-icons/react";
import { PlusIcon } from "@phosphor-icons/react";
import { XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ds/button";
import { Input } from "@/components/ds/input";
import { Popover } from "@/components/ds/popover";
import { cn } from "@/lib/utils";
import type { DependencySelectorProps, Flag } from "./types";

const EMPTY_VALUES: string[] = [];
const EMPTY_FLAGS: Flag[] = [];

export function DependencySelector({
	value = EMPTY_VALUES,
	onChange,
	availableFlags = EMPTY_FLAGS,
	currentFlagKey,
}: DependencySelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");

	const selectableFlags = availableFlags.filter(
		(flag) => flag.key !== currentFlagKey && !value.includes(flag.key)
	);

	const filteredFlags = selectableFlags.filter(
		(flag) =>
			flag.name?.toLowerCase().includes(search.toLowerCase()) ||
			flag.key.toLowerCase().includes(search.toLowerCase())
	);

	const selectedFlags = value
		.map((key) => availableFlags.find((f) => f.key === key))
		.filter(Boolean) as Flag[];

	const handleSelect = (flagKey: string) => {
		onChange([...value, flagKey]);
		setSearch("");
	};

	const handleRemove = (flagKey: string) => {
		onChange(value.filter((k) => k !== flagKey));
	};

	if (selectableFlags.length === 0 && value.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				No other flags available
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{selectedFlags.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					<AnimatePresence mode="popLayout">
						{selectedFlags.map((flag) => {
							const isActive = flag.status === "active";
							return (
								<motion.div
									animate={{ opacity: 1, scale: 1 }}
									className="group inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-foreground text-xs"
									exit={{ opacity: 0, scale: 0.9 }}
									initial={{ opacity: 0, scale: 0.9 }}
									key={flag.key}
									layout
								>
									<div
										className={cn(
											"size-1.5 rounded-full",
											isActive ? "bg-success" : "bg-warning"
										)}
									/>
									<span>{flag.name || flag.key}</span>
									<button
										aria-label={`Remove ${flag.name || flag.key}`}
										className="cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
										onClick={() => handleRemove(flag.key)}
										type="button"
									>
										<XIcon className="size-3" />
									</button>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			)}

			{selectableFlags.length > 0 && (
				<Popover onOpenChange={setIsOpen} open={isOpen}>
					<Popover.Trigger
						render={
							<Button
								className="text-muted-foreground"
								size="sm"
								type="button"
								variant="ghost"
							/>
						}
					>
						<PlusIcon className="size-3.5" />
						Add dependency
					</Popover.Trigger>
					<Popover.Content className="w-64 p-2" side="bottom">
						<div className="mb-2">
							<Input
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search flags…"
								value={search}
							/>
						</div>
						<div
							className="max-h-40 space-y-0.5 overflow-y-auto"
							onTouchMove={(e) => e.stopPropagation()}
							onWheel={(e) => e.stopPropagation()}
						>
							{filteredFlags.length > 0 ? (
								filteredFlags.map((flag) => {
									const isActive = flag.status === "active";
									return (
										<button
											className="flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left text-foreground text-xs transition-colors hover:bg-interactive-hover"
											key={flag.key}
											onClick={() => {
												handleSelect(flag.key);
												setIsOpen(false);
											}}
											type="button"
										>
											{isActive ? (
												<CheckCircleIcon
													className="shrink-0 text-success"
													size={14}
													weight="fill"
												/>
											) : (
												<CircleIcon
													className="shrink-0 text-warning"
													size={14}
												/>
											)}
											<span className="truncate">{flag.name || flag.key}</span>
										</button>
									);
								})
							) : (
								<p className="py-2 text-center text-muted-foreground text-xs">
									No flags found
								</p>
							)}
						</div>
					</Popover.Content>
				</Popover>
			)}

			{value.length > 0 && (
				<p className="text-muted-foreground text-xs">
					This flag requires all dependencies to be active
				</p>
			)}
		</div>
	);
}
