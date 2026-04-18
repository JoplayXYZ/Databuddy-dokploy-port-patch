import {
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const links = pgTable(
	"links",
	{
		id: text().primaryKey(),
		organizationId: text("organization_id").notNull(),
		createdBy: text("created_by").notNull(),
		slug: text().notNull(),
		name: text().notNull(),
		targetUrl: text("target_url").notNull(),
		expiresAt: timestamp("expires_at", { precision: 3, withTimezone: true }),
		expiredRedirectUrl: text("expired_redirect_url"),
		ogTitle: text("og_title"),
		ogDescription: text("og_description"),
		ogImageUrl: text("og_image_url"),
		ogVideoUrl: text("og_video_url"),
		iosUrl: text("ios_url"),
		androidUrl: text("android_url"),
		externalId: text("external_id"),
		deletedAt: timestamp("deleted_at", { precision: 3, withTimezone: true }),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("links_organization_id_idx").on(table.organizationId),
		index("links_created_by_idx").on(table.createdBy),
		index("links_external_id_idx").on(table.externalId),
		uniqueIndex("links_slug_unique").on(table.slug),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "links_organization_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "links_created_by_fkey",
		}).onDelete("cascade"),
	]
);

export type Link = typeof links.$inferSelect;
export type LinkInsert = typeof links.$inferInsert;
