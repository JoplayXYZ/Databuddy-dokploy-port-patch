import {
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { websites } from "./websites";

export interface UptimeJsonParsingConfig {
	enabled: boolean;
}

export const uptimeSchedules = pgTable(
	"uptime_schedules",
	{
		id: text().primaryKey(),
		websiteId: text("website_id"),
		organizationId: text("organization_id").notNull(),
		url: text().notNull(),
		name: text(),
		granularity: text().notNull(),
		cron: text().notNull(),
		isPaused: boolean("is_paused").default(false).notNull(),
		isPublic: boolean("is_public").default(false).notNull(),
		timeout: integer(),
		cacheBust: boolean("cache_bust").default(false).notNull(),
		jsonParsingConfig: jsonb("json_parsing_config").$type<UptimeJsonParsingConfig>(),
		lastNotifiedStatus: integer("last_notified_status"),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("uptime_schedules_website_id_idx").on(table.websiteId),
		index("uptime_schedules_organization_id_idx").on(table.organizationId),
		foreignKey({
			columns: [table.websiteId],
			foreignColumns: [websites.id],
			name: "uptime_schedules_website_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "uptime_schedules_organization_id_organization_id_fk",
		}).onDelete("cascade"),
	]
);

export const statusPages = pgTable(
	"status_pages",
	{
		id: text().primaryKey(),
		organizationId: text("organization_id").notNull(),
		slug: text().notNull(),
		name: text().notNull(),
		description: text(),
		logoUrl: text("logo_url"),
		faviconUrl: text("favicon_url"),
		websiteUrl: text("website_url"),
		supportUrl: text("support_url"),
		theme: text().$type<"system" | "light" | "dark">().default("system"),
		hideBranding: boolean("hide_branding").default(false).notNull(),
		customCss: text("custom_css"),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("status_pages_organization_id_idx").on(table.organizationId),
		uniqueIndex("status_pages_slug_unique").on(table.slug),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "status_pages_organization_id_fkey",
		}).onDelete("cascade"),
	]
);

export const statusPageMonitors = pgTable(
	"status_page_monitors",
	{
		id: text().primaryKey(),
		statusPageId: text("status_page_id").notNull(),
		uptimeScheduleId: text("uptime_schedule_id").notNull(),
		displayName: text("display_name"),
		order: integer().default(0).notNull(),
		hideUrl: boolean("hide_url").default(false).notNull(),
		hideUptimePercentage: boolean("hide_uptime_percentage")
			.default(false)
			.notNull(),
		hideLatency: boolean("hide_latency").default(false).notNull(),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("status_page_monitors_status_page_id_idx").on(table.statusPageId),
		index("status_page_monitors_uptime_schedule_id_idx").on(
			table.uptimeScheduleId
		),
		foreignKey({
			columns: [table.statusPageId],
			foreignColumns: [statusPages.id],
			name: "status_page_monitors_status_page_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.uptimeScheduleId],
			foreignColumns: [uptimeSchedules.id],
			name: "status_page_monitors_uptime_schedule_id_fkey",
		}).onDelete("cascade"),
	]
);

export type UptimeSchedules = typeof uptimeSchedules.$inferSelect;
export type UptimeSchedulesInsert = typeof uptimeSchedules.$inferInsert;
export type StatusPages = typeof statusPages.$inferSelect;
export type StatusPagesInsert = typeof statusPages.$inferInsert;
export type StatusPageMonitors = typeof statusPageMonitors.$inferSelect;
export type StatusPageMonitorsInsert = typeof statusPageMonitors.$inferInsert;
