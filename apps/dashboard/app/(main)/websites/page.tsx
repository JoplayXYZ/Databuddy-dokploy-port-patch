import { orpcServer } from "@/lib/orpc-server";
import { HydratedPage } from "@/lib/ssr-hydration";
import { WebsitesContent } from "./_components/websites-content";

export default function WebsitesPage() {
	return (
		<HydratedPage
			prefetch={(queryClient) =>
				queryClient.prefetchQuery(
					orpcServer.websites.listWithCharts.queryOptions({ input: {} })
				)
			}
		>
			<WebsitesContent />
		</HydratedPage>
	);
}
