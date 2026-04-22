import { orpcServer } from "@/lib/orpc-server";
import { HydratedPage } from "@/lib/ssr-hydration";
import { HomeContent } from "./_components/home-content";

export default function HomePage() {
	return (
		<HydratedPage
			prefetch={(queryClient) =>
				queryClient.prefetchQuery(
					orpcServer.websites.listWithCharts.queryOptions({ input: {} })
				)
			}
		>
			<HomeContent />
		</HydratedPage>
	);
}
