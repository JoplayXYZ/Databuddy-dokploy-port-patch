"use client";

import { useEffect } from "react";
import {
	StatusErrorShell,
	StatusRetryButton,
} from "./_components/status-error-shell";

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
		<StatusErrorShell
			action={<StatusRetryButton onClick={reset} />}
			code="500"
			description="Our bunny tripped over a wire. Let's try that again."
			detail={error.digest}
			title="Something went wrong"
		/>
	);
}
