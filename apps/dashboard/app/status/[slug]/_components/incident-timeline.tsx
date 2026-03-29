import { CheckCircleIcon } from "@phosphor-icons/react/ssr";

export function IncidentTimeline() {
	return (
		<div className="rounded border bg-card p-6">
			<h2 className="text-balance font-semibold text-sm">Recent Incidents</h2>
			<div className="mt-4 flex items-center gap-2.5 text-muted-foreground">
				<CheckCircleIcon
					className="size-4 shrink-0 text-emerald-500"
					weight="fill"
				/>
				<p className="text-pretty text-sm">
					No incidents reported in the last 90 days.
				</p>
			</div>
		</div>
	);
}
