import {
	CheckCircleIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
	operational: {
		label: "All Systems Operational",
		bgClass: "bg-emerald-500/10 border-emerald-500/20",
		textClass: "text-emerald-600 dark:text-emerald-400",
		dotClass: "bg-emerald-500",
		Icon: CheckCircleIcon,
		pulse: true,
	},
	degraded: {
		label: "Partial System Outage",
		bgClass: "bg-amber-500/10 border-amber-500/20",
		textClass: "text-amber-600 dark:text-amber-400",
		dotClass: "bg-amber-500",
		Icon: WarningCircleIcon,
		pulse: false,
	},
	outage: {
		label: "Major System Outage",
		bgClass: "bg-red-500/10 border-red-500/20",
		textClass: "text-red-600 dark:text-red-400",
		dotClass: "bg-red-500",
		Icon: XCircleIcon,
		pulse: false,
	},
} as const;

interface StatusBannerProps {
	overallStatus: "operational" | "degraded" | "outage";
}

export function StatusBanner({ overallStatus }: StatusBannerProps) {
	const config = STATUS_CONFIG[overallStatus];

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded border p-4",
				config.bgClass
			)}
		>
			<div className="relative flex shrink-0 items-center justify-center">
				{config.pulse ? (
					<span
						className={cn(
							"absolute size-6 animate-ping rounded-full opacity-20",
							config.dotClass
						)}
					/>
				) : null}
				<config.Icon
					className={cn("relative size-6 shrink-0", config.textClass)}
					weight="fill"
				/>
			</div>
			<span className={cn("font-semibold text-sm", config.textClass)}>
				{config.label}
			</span>
		</div>
	);
}
