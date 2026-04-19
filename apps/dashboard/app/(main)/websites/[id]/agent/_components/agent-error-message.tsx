"use client";

import {
	IconAlertWarningFillDuo18,
	IconRefreshFillDuo18,
	IconXmarkFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

function displayMessageForError(error: Error | undefined): string {
	if (!error?.message?.trim()) {
		return "Couldn't finish your request.";
	}

	const raw = error.message.trim();
	const lower = raw.toLowerCase();

	if (
		lower === "network error" ||
		lower.includes("failed to fetch") ||
		lower.includes("load failed") ||
		lower.includes("networkerror") ||
		lower.includes("fetch failed")
	) {
		return "Connection interrupted.";
	}

	if (error.name === "AbortError" || lower.includes("abort")) {
		return "Request cancelled.";
	}

	if (lower.includes("timeout") || lower.includes("timed out")) {
		return "Request timed out.";
	}

	if (
		lower.includes("premature close") ||
		lower.includes("connection closed")
	) {
		return "Connection dropped.";
	}

	return "Request failed.";
}

interface AgentErrorMessageProps {
	error: Error | undefined;
	onDismissAction: () => void;
	onRetryAction: () => Promise<void>;
}

export function AgentErrorMessage({
	error,
	onDismissAction,
	onRetryAction,
}: AgentErrorMessageProps) {
	const [isRetrying, setIsRetrying] = useState(false);

	const handleRetry = useCallback(async () => {
		setIsRetrying(true);
		try {
			await onRetryAction();
		} finally {
			setIsRetrying(false);
		}
	}, [onRetryAction]);

	const message = displayMessageForError(error);

	return (
		<div
			className="flex items-center gap-2 py-1.5 text-xs"
			role="alert"
		>
			<IconAlertWarningFillDuo18
				className="size-3.5 shrink-0 text-destructive"
			/>
			<span className="min-w-0 flex-1 truncate text-muted-foreground">
				{message}
			</span>
			<button
				aria-busy={isRetrying}
				aria-label="Try again"
				className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
				disabled={isRetrying}
				onClick={handleRetry}
				title="Try again"
				type="button"
			>
				<IconRefreshFillDuo18
					className={cn("size-3.5", isRetrying && "animate-spin")}
				/>
				<span>Try again</span>
			</button>
			<button
				aria-label="Dismiss"
				className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
				disabled={isRetrying}
				onClick={onDismissAction}
				title="Dismiss"
				type="button"
			>
				<IconXmarkFillDuo18 className="size-3" />
			</button>
		</div>
	);
}
