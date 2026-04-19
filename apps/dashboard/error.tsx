"use client";

import {
	IconAlertWarningFillDuo18,
	IconRefreshFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="flex min-h-dvh items-center justify-center bg-muted/20">
			<Card className="w-full max-w-lg border-destructive/50 shadow-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-destructive">
						<IconAlertWarningFillDuo18 className="size-6" size={24} />
						Something went wrong
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 pt-6">
					<p className="text-muted-foreground text-sm">
						We encountered an unexpected error. Please try again. If the problem
						persists, please contact support.
					</p>
					<pre className="max-h-[150px] overflow-auto rounded bg-muted p-3 font-mono text-xs">
						{error.message || "An unknown error occurred."}
					</pre>
					<Button onClick={() => reset()} size="sm">
						<IconRefreshFillDuo18 className="mr-2 size-4" size={16} />
						Try again
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
