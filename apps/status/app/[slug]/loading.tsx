import { Skeleton } from "@databuddy/ui";

function MonitorSkeleton() {
	return (
		<div>
			<div className="flex items-center justify-between pb-2.5">
				<div className="flex items-center gap-2.5">
					<Skeleton className="size-5 rounded-full" />
					<Skeleton className="h-4 w-32 rounded" />
					<Skeleton className="hidden h-3 w-24 rounded sm:block" />
				</div>
				<Skeleton className="h-4 w-16 rounded" />
			</div>
			<Skeleton className="h-7 w-full rounded" />
			<div className="mt-1.5 flex justify-between">
				<Skeleton className="h-2.5 w-12 rounded" />
				<Skeleton className="h-2.5 w-8 rounded" />
			</div>
		</div>
	);
}

export default function StatusLoading() {
	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-background">
			<div className="sticky top-0 z-30 border-border/60 border-b bg-background/80">
				<nav className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4 sm:px-6">
					<Skeleton className="size-5 rounded" />
					<Skeleton className="size-7 rounded" />
				</nav>
			</div>

			<main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				<div className="mx-auto max-w-2xl space-y-10 px-4 py-8 sm:px-6">
					<div className="space-y-4">
						<div className="flex items-center gap-3.5">
							<Skeleton className="size-10 rounded" />
							<div className="space-y-2">
								<Skeleton className="h-6 w-40 rounded" />
								<Skeleton className="h-3.5 w-56 rounded" />
							</div>
						</div>
						<div className="flex items-center gap-2.5">
							<Skeleton className="size-6 rounded-full" />
							<Skeleton className="h-4 w-44 rounded" />
						</div>
					</div>

					<div className="space-y-6">
						<MonitorSkeleton />
						<MonitorSkeleton />
						<MonitorSkeleton />
					</div>

					<Skeleton className="h-3 w-48 rounded" />
				</div>
			</main>

			<footer className="shrink-0 border-border/50 border-t bg-background">
				<div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4 sm:px-6">
					<Skeleton className="h-3 w-28 rounded" />
				</div>
			</footer>
		</div>
	);
}
