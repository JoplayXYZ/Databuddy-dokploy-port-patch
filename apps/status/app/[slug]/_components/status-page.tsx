import type { ReactNode } from "react";
import type { AppRouter } from "@databuddy/rpc";
import type { RouterClient } from "@orpc/server";
import { Badge, cn, StatusDot } from "@databuddy/ui";
import { Avatar } from "@databuddy/ui/client";
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

type StatusPageData = NonNullable<
	Awaited<ReturnType<RouterClient<AppRouter>["statusPage"]["getBySlug"]>>
>;
type Monitor = StatusPageData["monitors"][number];
type Incident = StatusPageData["incidents"][number];

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
		Icon: ShieldCheckIcon,
		pulse: true,
	},
	degraded: {
		label: "Partial System Outage",
		className: "text-amber-600 dark:text-amber-400",
		Icon: WarningCircleIcon,
		pulse: false,
	},
	outage: {
		label: "Major System Outage",
		className: "text-red-600 dark:text-red-400",
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
					<Avatar alt={name} className="rounded" size="lg" src={logoUrl} />
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
						<span className="absolute size-6 animate-ping rounded-full bg-success opacity-20" />
					) : null}
					<config.Icon className="relative size-6 shrink-0" />
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

const MONITOR_DOT_COLOR = {
	up: "success",
	degraded: "warning",
	down: "destructive",
	unknown: "muted",
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
	currentStatus: Monitor["currentStatus"];
	dailyData: Monitor["dailyData"];
	days: number;
	domain?: string;
	id: string;
	name: string;
	uptimePercentage?: number;
}) {
	const hasLatencyData = dailyData.some(
		(d) => d.avg_response_time != null || d.p95_response_time != null
	);

	return (
		<div className="scroll-mt-20" id={anchorId}>
			<div className="flex items-center justify-between pb-2.5">
				<div className="flex items-center gap-2.5 overflow-hidden">
					<StatusDot color={MONITOR_DOT_COLOR[currentStatus]} size="md" />
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
	return new Date(iso).toLocaleDateString("en-US", {
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

function incidentDotColor(
	incident: Incident
): "success" | "warning" | "destructive" | "muted" {
	if (incident.status === "resolved") {
		return "success";
	}
	if (incident.severity === "critical") {
		return "destructive";
	}
	if (incident.severity === "major") {
		return "warning";
	}
	return "muted";
}

function IncidentCard({ incident }: { incident: Incident }) {
	return (
		<div className="space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<StatusDot color={incidentDotColor(incident)} size="md" />
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
									<Badge
										key={am.statusPageMonitorId}
										size="sm"
										variant={am.impact === "down" ? "destructive" : "warning"}
									>
										{am.monitorName} ·{" "}
										{am.impact === "down" ? "Down" : "Degraded"}
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>
				<Badge
					size="sm"
					variant={incident.status === "resolved" ? "success" : "warning"}
				>
					{INCIDENT_STATUS_CONFIG[incident.status]?.label ?? incident.status}
				</Badge>
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
