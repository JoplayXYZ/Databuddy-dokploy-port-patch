export type Granularity = "minute" | "hour" | "day" | "week" | "month";

export type TimeUnit = Granularity | "hourly" | "daily";

export type SqlExpression = string & { readonly __brand: "SqlExpression" };

export interface AliasedExpression {
	readonly alias: string;
	readonly expression: SqlExpression;
}
