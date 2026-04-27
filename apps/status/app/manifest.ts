import type { MetadataRoute } from "next";
import { STATUS_URL } from "@/lib/status-url";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Databuddy Status",
		short_name: "Databuddy",
		description:
			"Live uptime, incident history, and service health for public Databuddy status pages.",
		start_url: STATUS_URL,
		display: "standalone",
		background_color: "#000000",
		theme_color: "#000000",
		icons: [
			{
				src: "/web-app-manifest-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/web-app-manifest-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
	};
}
