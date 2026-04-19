import {
	IconArrowTrendUpFillDuo18,
	IconChartActivityFillDuo18,
	IconCircleWarningFillDuo18,
	IconUsersFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ErrorSummary } from "./types";

interface ErrorSummaryStatsProps {
	errorSummary: ErrorSummary;
}

function ErrorStatCard({
	title,
	value,
	icon: Icon,
	variant = "default",
}: {
	title: string;
	value: string;
	icon: typeof IconCircleWarningFillDuo18;
	variant?: "default" | "destructive" | "warning";
}) {
	const variantStyles = {
		default: {
			iconBg: "bg-accent",
			iconColor: "text-muted-foreground",
		},
		destructive: {
			iconBg: "bg-destructive/10",
			iconColor: "text-destructive",
		},
		warning: {
			iconBg: "bg-amber-500/10",
			iconColor: "text-amber-600 dark:text-amber-400",
		},
	};

	const styles = variantStyles[variant];

	return (
		<Card className="gap-0 overflow-hidden border bg-card py-0">
			<div className="flex items-center gap-2.5 px-2.5 py-2.5">
				<div
					className={cn(
						"flex size-7 shrink-0 items-center justify-center rounded",
						styles.iconBg
					)}
				>
					<Icon className={cn("size-4", styles.iconColor)} />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-base tabular-nums leading-tight">
						{value}
					</p>
					<p className="truncate text-muted-foreground text-xs">{title}</p>
				</div>
			</div>
		</Card>
	);
}

export const ErrorSummaryStats = ({ errorSummary }: ErrorSummaryStatsProps) => (
	<div className="grid grid-cols-2 gap-2">
		<ErrorStatCard
			icon={IconCircleWarningFillDuo18}
			title="Total Errors"
			value={(errorSummary.totalErrors || 0).toLocaleString()}
			variant="destructive"
		/>
		<ErrorStatCard
			icon={IconArrowTrendUpFillDuo18}
			title="Error Rate"
			value={`${(errorSummary.errorRate || 0).toFixed(2)}%`}
			variant="warning"
		/>
		<ErrorStatCard
			icon={IconUsersFillDuo18}
			title="Affected Users"
			value={(errorSummary.affectedUsers || 0).toLocaleString()}
		/>
		<ErrorStatCard
			icon={IconChartActivityFillDuo18}
			title="Affected Sessions"
			value={(errorSummary.affectedSessions || 0).toLocaleString()}
		/>
	</div>
);
