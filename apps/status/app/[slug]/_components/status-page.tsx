import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@databuddy/ui";
import {
	BoltLightningIcon,
	CheckCircleIcon,
	CircleInfoIcon,
	ClockRotateIcon,
	ShieldCheckIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@databuddy/ui/icons";
import { MonitorRowInteractive } from "./monitor-row-interactive";

function StatusRoot({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-10", className)} data-slot="status-page">
			{children}
		</div>
	);
}

const STATUS_CONFIG = {
	operational: {
		label: "All Systems Operational",
		className: "text-emerald-600 dark:text-emerald-400",
		dotClass: "bg-emerald-500",
		Icon: ShieldCheckIcon,
		pulse: true,
	},
	degraded: {
		label: "Partial System Outage",
		className: "text-amber-600 dark:text-amber-400",
		dotClass: "bg-amber-500",
		Icon: WarningCircleIcon,
		pulse: false,
	},
	outage: {
		label: "Major System Outage",
		className: "text-red-600 dark:text-red-400",
		dotClass: "bg-red-500",
		Icon: XCircleIcon,
		pulse: false,
	},
} as const;

interface StatusHeaderProps {
	children?: ReactNode;
	className?: string;
	description?: string;
	logoUrl?: string | null;
	name: string;
	status: "operational" | "degraded" | "outage";
	websiteUrl?: string | null;
}

function StatusHeader({
	name,
	description,
	logoUrl,
	websiteUrl,
	status,
	children,
	className,
}: StatusHeaderProps) {
	const config = STATUS_CONFIG[status];
	const heading = (
		<h1 className="font-semibold text-[22px] tracking-tight">{name}</h1>
	);

	return (
		<div className={cn("space-y-4", className)} data-slot="status-header">
			<div className="flex items-center gap-3.5">
				{logoUrl ? (
					<Image
						alt=""
						className="size-10 shrink-0 rounded object-contain"
						height={40}
						src={logoUrl}
						unoptimized
						width={40}
					/>
				) : null}
				<div className="min-w-0 flex-1">
					{websiteUrl ? (
						<a
							className="transition-opacity hover:opacity-80"
							href={websiteUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							{heading}
						</a>
					) : (
						heading
					)}
					{description && (
						<p className="mt-0.5 text-[13px] text-muted-foreground">
							{description}
						</p>
					)}
				</div>
				{children}
			</div>

			<div className={cn("flex items-center gap-2.5", config.className)}>
				<div className="relative flex shrink-0 items-center justify-center">
					{config.pulse ? (
						<span
							className={cn(
								"absolute size-6 animate-ping rounded-full opacity-20",
								config.dotClass
							)}
						/>
					) : null}
					<config.Icon className="relative size-6 shrink-0" weight="fill" />
				</div>
				<span className="font-medium text-[15px]">{config.label}</span>
			</div>
		</div>
	);
}

function StatusMonitorList({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-6", className)} data-slot="status-monitors">
			{children}
		</div>
	);
}

const MONITOR_DOT = {
	up: "bg-emerald-500",
	degraded: "bg-amber-500",
	down: "bg-red-500",
	unknown: "bg-muted-foreground/40",
} as const;

function uptimeColor(pct: number): string {
	if (pct >= 99.9) {
		return "text-emerald-600 dark:text-emerald-400";
	}
	if (pct >= 99) {
		return "text-amber-600 dark:text-amber-400";
	}
	return "text-red-600 dark:text-red-400";
}

function StatusMonitorCard({
	id,
	anchorId,
	name,
	domain,
	currentStatus,
	uptimePercentage,
	dailyData,
	days,
}: {
	anchorId: string;
	currentStatus: "up" | "down" | "degraded" | "unknown";
	dailyData: Array<{
		avg_response_time?: number;
		date: string;
		p95_response_time?: number;
		uptime_percentage?: number;
	}>;
	days: number;
	domain?: string;
	id: string;
	name: string;
	uptimePercentage?: number;
}) {
	const dotColor = MONITOR_DOT[currentStatus];
	const hasLatencyData = dailyData.some(
		(d) => d.avg_response_time != null || d.p95_response_time != null
	);

	return (
		<div className="scroll-mt-20" id={anchorId}>
			<div className="flex items-center justify-between pb-2.5">
				<div className="flex items-center gap-2.5 overflow-hidden">
					<span className={cn("size-2 shrink-0 rounded-full", dotColor)} />
					<span className="truncate font-medium text-[15px]">{name}</span>
					{domain && (
						<span className="hidden truncate text-[13px] text-muted-foreground sm:inline">
							{domain}
						</span>
					)}
				</div>
				{uptimePercentage !== undefined && (
					<span
						className={cn(
							"shrink-0 font-mono font-semibold text-[15px] tabular-nums",
							uptimeColor(uptimePercentage)
						)}
					>
						{uptimePercentage.toFixed(2)}%
					</span>
				)}
			</div>

			<MonitorRowInteractive
				dailyData={dailyData}
				days={days}
				hasLatencyData={hasLatencyData}
				hasUptimeData={uptimePercentage !== undefined}
				id={id}
			/>
		</div>
	);
}

interface IncidentUpdate {
	createdAt: string;
	id: string;
	message: string;
	status: string;
}

interface AffectedMonitor {
	impact: string;
	monitorName: string;
	statusPageMonitorId: string;
}

interface Incident {
	affectedMonitors: AffectedMonitor[];
	createdAt: string;
	id: string;
	resolvedAt: string | null;
	severity: string;
	status: string;
	title: string;
	updates: IncidentUpdate[];
}

const INCIDENT_STATUS_CONFIG: Record<
	string,
	{ label: string; Icon: typeof CheckCircleIcon }
> = {
	investigating: { label: "Investigating", Icon: BoltLightningIcon },
	identified: { label: "Identified", Icon: CircleInfoIcon },
	monitoring: { label: "Monitoring", Icon: ClockRotateIcon },
	resolved: { label: "Resolved", Icon: CheckCircleIcon },
};

function formatIncidentDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function StatusIncidentList({
	incidents,
	className,
}: {
	className?: string;
	incidents: Incident[];
}) {
	const active = incidents.filter((i) => i.status !== "resolved");
	const resolved = incidents.filter((i) => i.status === "resolved");

	if (active.length === 0 && resolved.length === 0) {
		return null;
	}

	return (
		<div className={cn("space-y-6", className)}>
			{active.length > 0 && (
				<div className="space-y-4">
					<h2 className="font-semibold text-[15px]">Active Incidents</h2>
					{active.map((incident) => (
						<IncidentCard incident={incident} key={incident.id} />
					))}
				</div>
			)}
			{resolved.length > 0 && (
				<div className="space-y-4">
					<h2 className="font-semibold text-[15px]">Past Incidents</h2>
					{resolved.map((incident) => (
						<IncidentCard incident={incident} key={incident.id} />
					))}
				</div>
			)}
		</div>
	);
}

function IncidentCard({ incident }: { incident: Incident }) {
	const isResolved = incident.status === "resolved";

	return (
		<div className="space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"size-2 shrink-0 rounded-full",
								isResolved
									? "bg-emerald-500"
									: incident.severity === "critical"
										? "bg-red-500"
										: incident.severity === "major"
											? "bg-amber-500"
											: "bg-muted-foreground/40"
							)}
						/>
						<span className="font-medium text-[14px]">{incident.title}</span>
					</div>
					<div className="ml-6 space-y-1">
						<span className="text-muted-foreground text-xs">
							{formatIncidentDate(incident.createdAt)}
							{incident.resolvedAt &&
								` — Resolved ${formatIncidentDate(incident.resolvedAt)}`}
						</span>
						{incident.affectedMonitors.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{incident.affectedMonitors.map((am) => (
									<span
										className={cn(
											"rounded px-1.5 py-0.5 font-medium text-[11px]",
											am.impact === "down"
												? "bg-red-500/10 text-red-600 dark:text-red-400"
												: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
										)}
										key={am.statusPageMonitorId}
									>
										{am.monitorName} ·{" "}
										{am.impact === "down" ? "Down" : "Degraded"}
									</span>
								))}
							</div>
						)}
					</div>
				</div>
				<span
					className={cn(
						"shrink-0 rounded-full px-2 py-0.5 font-medium text-[11px]",
						isResolved
							? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
							: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
					)}
				>
					{INCIDENT_STATUS_CONFIG[incident.status]?.label ?? incident.status}
				</span>
			</div>

			{incident.updates.length > 0 && (
				<div className="ml-6 space-y-3 border-border/50 border-l-2 pl-4">
					{incident.updates.map((update) => {
						const statusConfig = INCIDENT_STATUS_CONFIG[update.status];
						const UpdateIcon = statusConfig?.Icon ?? CircleInfoIcon;
						return (
							<div className="space-y-0.5" key={update.id}>
								<div className="flex items-center gap-1.5">
									<UpdateIcon className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="font-medium text-xs">
										{statusConfig?.label ?? update.status}
									</span>
									<span className="text-muted-foreground/60 text-xs">
										{formatIncidentDate(update.createdAt)}
									</span>
								</div>
								<p className="ml-5 text-[13px] text-muted-foreground leading-relaxed">
									{update.message}
								</p>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function StatusFooter({
	timestamp,
	incidents,
	className,
}: {
	className?: string;
	incidents: Incident[];
	timestamp: string | null;
}) {
	const activeCount = incidents.filter((i) => i.status !== "resolved").length;

	return (
		<div
			className={cn(
				"flex items-center justify-between text-muted-foreground/60 text-xs",
				className
			)}
		>
			<span>
				{activeCount > 0
					? `${activeCount} active incident${activeCount === 1 ? "" : "s"}`
					: "No incidents in the last 90 days"}
			</span>
			{timestamp && (
				<span className="tabular-nums">
					Updated{" "}
					{new Date(timestamp).toLocaleTimeString("en-US", {
						hour: "numeric",
						minute: "2-digit",
					})}
				</span>
			)}
		</div>
	);
}

StatusRoot.displayName = "Status";

export const Status: typeof StatusRoot & {
	Footer: typeof StatusFooter;
	Header: typeof StatusHeader;
	IncidentList: typeof StatusIncidentList;
	MonitorCard: typeof StatusMonitorCard;
	MonitorList: typeof StatusMonitorList;
} = Object.assign(StatusRoot, {
	Footer: StatusFooter,
	Header: StatusHeader,
	IncidentList: StatusIncidentList,
	MonitorCard: StatusMonitorCard,
	MonitorList: StatusMonitorList,
});
