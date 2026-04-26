import { db } from "@databuddy/db";
import { statusPages } from "@databuddy/db/schema";
import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { getStatusPageUrl } from "@/lib/app-url";
import type { StatusSitemapRow } from "@/types/sitemap";

export const revalidate = 86_400;

const getPublicStatusPages = unstable_cache(
	async (): Promise<StatusSitemapRow[]> => {
		const rows = await db
			.select({
				slug: statusPages.slug,
				updatedAt: statusPages.updatedAt,
			})
			.from(statusPages);

		const statusPagesBySlug = new Map<string, Date>();

		for (const row of rows) {
			if (!row.slug) {
				continue;
			}

			const existingUpdatedAt = statusPagesBySlug.get(row.slug);
			if (!existingUpdatedAt || row.updatedAt > existingUpdatedAt) {
				statusPagesBySlug.set(row.slug, row.updatedAt);
			}
		}

		return [...statusPagesBySlug.entries()]
			.map(([slug, updatedAt]) => ({ slug, updatedAt }))
			.sort((a, b) => a.slug.localeCompare(b.slug));
	},
	["dashboard-status-sitemap"],
	{ revalidate: 86_400, tags: ["status-page"] }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	if (process.env.NODE_ENV === "development") {
		return [];
	}

	try {
		const statusPages = await getPublicStatusPages();

		return statusPages.map((statusPage) => ({
			url: getStatusPageUrl(statusPage.slug),
			lastModified: statusPage.updatedAt,
			changeFrequency: "daily",
			priority: 0.7,
		}));
	} catch {
		return [];
	}
}
