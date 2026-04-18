import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const featureInvite = pgTable(
	"feature_invite",
	{
		id: text().primaryKey(),
		flagKey: text("flag_key").notNull(),
		token: text().notNull(),
		status: text().default("active").notNull(),
		invitedById: text("invited_by_id").notNull(),
		redeemedById: text("redeemed_by_id"),
		redeemedAt: timestamp("redeemed_at", { precision: 3, withTimezone: true }),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("feature_invite_token_idx").on(table.token),
		index("feature_invite_flag_inviter_idx").on(
			table.flagKey,
			table.invitedById
		),
		foreignKey({
			columns: [table.invitedById],
			foreignColumns: [user.id],
			name: "feature_invite_inviter_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.redeemedById],
			foreignColumns: [user.id],
			name: "feature_invite_redeemer_fk",
		}).onDelete("set null"),
	]
);

export const featureAccessLog = pgTable(
	"feature_access_log",
	{
		id: text().primaryKey(),
		flagKey: text("flag_key").notNull(),
		actionType: text("action_type").notNull(),
		actorId: text("actor_id"),
		targetEmail: text("target_email").notNull(),
		organizationId: text("organization_id").notNull(),
		metadata: jsonb().$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("feature_access_log_flag_idx").on(table.flagKey),
		index("feature_access_log_org_idx").on(table.organizationId),
		index("feature_access_log_created_idx").on(table.createdAt),
	]
);

export type FeatureInvite = typeof featureInvite.$inferSelect;
export type FeatureInviteInsert = typeof featureInvite.$inferInsert;
export type FeatureAccessLog = typeof featureAccessLog.$inferSelect;
export type FeatureAccessLogInsert = typeof featureAccessLog.$inferInsert;
