"use client";

import { useEffect } from "react";
import {
	StatusErrorShell,
	StatusRetryButton,
} from "./_components/status-error-shell";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Status app global error:", error);
	}, [error]);

	return (
		<html lang="en">
			<body className="bg-background font-sans text-foreground antialiased">
				<StatusErrorShell
					action={<StatusRetryButton onClick={reset} />}
					code="500"
					description="The status app hit an unexpected error before it could finish rendering."
					detail={error.digest}
					title="Status app unavailable"
				/>
			</body>
		</html>
	);
}
