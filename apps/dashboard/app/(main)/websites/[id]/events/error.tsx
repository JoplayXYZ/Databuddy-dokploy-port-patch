"use client";

import {
	IconArrowLeftFillDuo18,
	IconBoltLightningFillDuo18,
	IconUndoFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EventsError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();
	const params = useParams();
	const websiteId = params.id as string;

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
			<div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
				<IconBoltLightningFillDuo18 className="size-6 text-destructive" />
			</div>
			<div className="max-w-sm space-y-2 text-center">
				<h2 className="font-semibold text-lg">Error loading events</h2>
				<p className="text-balance text-muted-foreground text-sm">
					{error.message || "An error occurred while loading events data"}
				</p>
				{error.digest && (
					<p className="font-mono text-muted-foreground text-xs">
						Error ID: {error.digest}
					</p>
				)}
			</div>
			<div className="flex gap-2">
				<Button onClick={reset} variant="outline">
					<IconUndoFillDuo18 className="mr-2 size-4" />
					Try again
				</Button>
				<Button
					onClick={() => router.push(`/websites/${websiteId}`)}
					variant="ghost"
				>
					<IconArrowLeftFillDuo18 className="mr-2 size-4" />
					Back to overview
				</Button>
			</div>
		</div>
	);
}
