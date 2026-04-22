import "server-only";
import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
	dehydrateDefaults,
	hydrateDefaults,
} from "@/lib/orpc-dehydrate-serializer";

interface HydratedPageProps {
	children: ReactNode;
	prefetch: (queryClient: QueryClient) => Promise<unknown>;
}

export async function HydratedPage({ prefetch, children }: HydratedPageProps) {
	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: dehydrateDefaults,
			hydrate: hydrateDefaults,
		},
	});

	await prefetch(queryClient).catch(() => undefined);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			{children}
		</HydrationBoundary>
	);
}
