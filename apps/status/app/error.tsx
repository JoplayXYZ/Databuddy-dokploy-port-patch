"use client";

import { useEffect } from "react";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Status page error:", error);
	}, [error]);

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
			<div className="flex w-full max-w-sm flex-col items-center text-center">
				<h1 className="text-balance font-semibold text-foreground text-lg">
					Something went wrong
				</h1>
				<p className="mt-2 text-pretty text-muted-foreground text-sm leading-relaxed">
					We couldn&apos;t load this status page. Please try again.
				</p>
				<button
					className="mt-6 rounded border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent"
					onClick={() => reset()}
					type="button"
				>
					Try again
				</button>
			</div>
		</div>
	);
}
