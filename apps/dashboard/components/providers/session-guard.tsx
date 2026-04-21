"use client";

import { authClient } from "@databuddy/auth/client";
import { useEffect } from "react";

export function SessionGuard({ children }: { children: React.ReactNode }) {
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		if (isPending || session) {
			return;
		}

		authClient.signOut().finally(() => {
			window.location.href = "/login";
		});
	}, [isPending, session]);

	return <>{children}</>;
}
