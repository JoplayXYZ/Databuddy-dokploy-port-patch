import { orpcServer } from "@/lib/orpc-server";
import { HydratedPage } from "@/lib/ssr-hydration";
import { WebsiteOverviewContent } from "./_components/website-overview-content";

interface WebsiteDetailsPageProps {
	params: Promise<{ id: string }>;
}

export default async function WebsiteDetailsPage({
	params,
}: WebsiteDetailsPageProps) {
	const { id } = await params;

	return (
		<HydratedPage
			prefetch={(queryClient) =>
				queryClient.prefetchQuery(
					orpcServer.websites.getById.queryOptions({ input: { id } })
				)
			}
		>
			<WebsiteOverviewContent websiteId={id} />
		</HydratedPage>
	);
}
