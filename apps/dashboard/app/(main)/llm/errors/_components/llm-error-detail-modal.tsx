"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { ClockIcon } from "@phosphor-icons/react";
import { CodeIcon } from "@phosphor-icons/react";
import { CopyIcon } from "@phosphor-icons/react";
import { RobotIcon } from "@phosphor-icons/react";
import { StackIcon } from "@phosphor-icons/react";
import { TimerIcon } from "@phosphor-icons/react";
import { WarningIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { fromNow } from "@/lib/time";
import type { LLMRecentErrorData } from "../../_components/llm-types";
import { formatDuration } from "../../_components/llm-types";

interface LLMErrorDetailModalProps {
	error: LLMRecentErrorData;
	isOpen: boolean;
	onCloseAction: () => void;
}

type CopiedSection = "name" | "message" | "stack" | "all" | null;

function formatDateTimeSeconds(timestamp: string): string {
	const date = new Date(timestamp);
	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function getHttpStatusSeverity(
	status?: number
): "high" | "medium" | "low" | null {
	if (!status) {
		return null;
	}
	if (status >= 500) {
		return "high";
	}
	if (status >= 400) {
		return "medium";
	}
	return "low";
}

function getSeverityColor(severity: "high" | "medium" | "low"): string {
	const colors = {
		high: "bg-destructive/10 text-destructive border-destructive/20",
		medium: "bg-chart-2/10 text-chart-2 border-chart-2/20",
		low: "bg-chart-3/10 text-chart-3 border-chart-3/20",
	};
	return colors[severity];
}

const CopyButton = ({
	text,
	section,
	copiedSection,
	onCopy,
	ariaLabel,
}: {
	text: string;
	section: CopiedSection;
	copiedSection: CopiedSection;
	onCopy: (text: string, section: CopiedSection) => void;
	ariaLabel?: string;
}) => {
	const isCopied = copiedSection === section;

	return (
		<Button
			aria-label={ariaLabel || `Copy ${section}`}
			className="size-7 shrink-0"
			onClick={() => onCopy(text, section)}
			size="icon"
			variant="ghost"
		>
			{isCopied ? (
				<CheckIcon className="size-3.5 text-green-500" weight="bold" />
			) : (
				<CopyIcon className="size-3.5 text-muted-foreground" />
			)}
		</Button>
	);
};

export function LLMErrorDetailModal({
	error,
	isOpen,
	onCloseAction,
}: LLMErrorDetailModalProps) {
	const [copiedSection, setCopiedSection] = useState<CopiedSection>(null);

	if (!error) {
		return null;
	}

	const copyToClipboard = async (text: string, section: CopiedSection) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedSection(section);
			toast.success("Copied to clipboard");
			setTimeout(() => setCopiedSection(null), 2000);
		} catch (err) {
			toast.error("Failed to copy", {
				description: err instanceof Error ? err.message : "Unknown error",
			});
		}
	};

	const relativeTimeStr = fromNow(error.timestamp);
	const httpSeverity = getHttpStatusSeverity(error.http_status);

	const fullErrorInfo = `LLM Error: ${error.error_name}
${error.error_message ? `\nMessage:\n${error.error_message}` : ""}
${error.error_stack ? `\nStack Trace:\n${error.error_stack}` : ""}

Context:
• Model: ${error.model}
• Provider: ${error.provider}
• HTTP Status: ${error.http_status ?? "N/A"}
• Latency: ${formatDuration(error.duration_ms)}
• Time: ${formatDateTimeSeconds(error.timestamp)}`;

	const contextRows = [
		{
			key: "model",
			label: "Model",
			value: error.model,
			icon: (
				<RobotIcon
					className="size-4 shrink-0 text-muted-foreground"
					weight="duotone"
				/>
			),
		},
		{
			key: "provider",
			label: "Provider",
			value: error.provider,
			icon: (
				<CodeIcon
					className="size-4 shrink-0 text-muted-foreground"
					weight="duotone"
				/>
			),
		},
		{
			key: "http_status",
			label: "HTTP Status",
			value: error.http_status ? String(error.http_status) : "—",
			icon: (
				<WarningIcon
					className="size-4 shrink-0 text-muted-foreground"
					weight="duotone"
				/>
			),
		},
		{
			key: "latency",
			label: "Latency",
			value: formatDuration(error.duration_ms),
			icon: (
				<TimerIcon
					className="size-4 shrink-0 text-muted-foreground"
					weight="duotone"
				/>
			),
		},
	];

	return (
		<Sheet onOpenChange={onCloseAction} open={isOpen}>
			<SheetContent className="sm:max-w-xl" side="right">
				<SheetHeader>
					<div className="flex items-center gap-4">
						<div className="flex size-11 items-center justify-center rounded bg-destructive/10">
							<WarningIcon
								className="size-6 text-destructive"
								weight="duotone"
							/>
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<SheetTitle className="text-foreground text-lg">
									{error.error_name}
								</SheetTitle>
								{httpSeverity && (
									<Badge className={getSeverityColor(httpSeverity)}>
										{error.http_status}
									</Badge>
								)}
							</div>
							<SheetDescription className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs sm:text-sm">
								<ClockIcon className="size-3.5" weight="duotone" />
								<span>{relativeTimeStr}</span>
								<span className="text-muted-foreground/50">•</span>
								<span className="font-mono">
									{formatDateTimeSeconds(error.timestamp)}
								</span>
							</SheetDescription>
						</div>
					</div>
				</SheetHeader>

				<SheetBody className="space-y-6">
					{/* Quick Actions */}
					<section className="space-y-3">
						<span className="font-medium text-muted-foreground text-xs uppercase">
							Quick actions
						</span>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() => copyToClipboard(error.error_name, "name")}
								size="sm"
								variant="outline"
							>
								<CopyIcon className="size-3.5" />
								Copy Error Name
							</Button>
							{error.error_message && (
								<Button
									onClick={() =>
										copyToClipboard(error.error_message, "message")
									}
									size="sm"
									variant="ghost"
								>
									<CodeIcon className="size-3.5" weight="duotone" />
									Copy Message
								</Button>
							)}
							{error.error_stack && (
								<Button
									onClick={() =>
										copyToClipboard(error.error_stack ?? "", "stack")
									}
									size="sm"
									variant="ghost"
								>
									<StackIcon className="size-3.5" weight="duotone" />
									Copy Stack
								</Button>
							)}
						</div>
					</section>

					{/* Error Name */}
					<section className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<WarningIcon
									className="size-4 text-destructive"
									weight="duotone"
								/>
								<span className="font-medium text-foreground text-sm">
									Error Name
								</span>
							</div>
							<CopyButton
								ariaLabel="Copy error name"
								copiedSection={copiedSection}
								onCopy={copyToClipboard}
								section="name"
								text={error.error_name}
							/>
						</div>
						<div className="rounded border bg-accent/30 p-4">
							<p className="wrap-break-word font-medium text-destructive text-sm leading-relaxed">
								{error.error_name}
							</p>
						</div>
					</section>

					{/* Error Message */}
					{error.error_message && (
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<CodeIcon className="size-4 text-chart-2" weight="duotone" />
									<span className="font-medium text-foreground text-sm">
										Error Message
									</span>
								</div>
								<CopyButton
									ariaLabel="Copy error message"
									copiedSection={copiedSection}
									onCopy={copyToClipboard}
									section="message"
									text={error.error_message}
								/>
							</div>
							<div className="rounded border bg-accent/30 p-4">
								<pre className="wrap-break-word max-h-40 overflow-auto whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
									{error.error_message}
								</pre>
							</div>
						</section>
					)}

					{/* Stack Trace */}
					{error.error_stack && (
						<section>
							<Accordion collapsible defaultValue="stack" type="single">
								<AccordionItem value="stack">
									<AccordionTrigger>
										<div className="flex items-center gap-2">
											<StackIcon
												className="size-4 text-chart-3"
												weight="duotone"
											/>
											<span className="font-medium text-foreground text-sm">
												Stack Trace
											</span>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="relative rounded border bg-accent/30 p-4">
											<pre className="wrap-break-word max-h-64 overflow-auto whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
												{error.error_stack}
											</pre>
											<div className="absolute top-4 right-4">
												<CopyButton
													ariaLabel="Copy stack trace"
													copiedSection={copiedSection}
													onCopy={copyToClipboard}
													section="stack"
													text={error.error_stack}
												/>
											</div>
										</div>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</section>
					)}

					{/* Context */}
					<section className="space-y-3">
						<span className="font-medium text-foreground text-sm">Context</span>
						<div className="rounded border bg-accent/30">
							{contextRows.map((row, index) => (
								<div
									className={`flex items-center justify-between gap-3 px-3 py-2.5 ${index > 0 ? "border-t" : ""}`}
									key={row.key}
								>
									<div className="flex min-w-0 items-center gap-3">
										{row.icon}
										<div className="min-w-0">
											<span className="text-muted-foreground text-xs">
												{row.label}
											</span>
											<p
												className="truncate font-mono text-foreground text-sm"
												title={row.value}
											>
												{row.value}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				</SheetBody>

				<SheetFooter>
					<Button onClick={onCloseAction} type="button" variant="outline">
						Close
					</Button>
					<Button
						className="gap-2"
						onClick={() => copyToClipboard(fullErrorInfo, "all")}
						variant="outline"
					>
						{copiedSection === "all" ? (
							<CheckIcon className="size-4 text-green-500" weight="bold" />
						) : (
							<CopyIcon className="size-4" />
						)}
						Copy All
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
