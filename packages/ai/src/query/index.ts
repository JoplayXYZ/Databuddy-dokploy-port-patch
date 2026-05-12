/** biome-ignore-all lint/performance/noBarrelFile: this is a barrel file */
import { z } from "zod";
import { QueryBuilders } from "./builders";
import { SimpleQueryBuilder } from "./simple-builder";
import type { QueryRequest } from "./types";

const QuerySchema = z.object({
	projectId: z.string(),
	type: z.string(),
	from: z.string(),
	to: z.string(),
	timeUnit: z.enum(["minute", "hour", "day", "week", "month"]).default("day"),
	filters: z
		.array(
			z.object({
				field: z.string(),
				op: z.enum([
					"eq",
					"ne",
					"contains",
					"not_contains",
					"starts_with",
					"in",
					"not_in",
				]),
				value: z.union([
					z.string(),
					z.number(),
					z.array(z.union([z.string(), z.number()])),
				]),
				target: z.string().optional(),
				having: z.boolean().optional(),
			})
		)
		.optional(),
	groupBy: z.array(z.string()).optional(),
	orderBy: z.string().optional(),
	limit: z.number().min(1).max(1000).optional(),
	offset: z.number().min(0).optional(),
	timezone: z.string().optional(),
});

export function suggestQueryTypes(input: string, limit = 5): string[] {
	const lower = input.toLowerCase();
	const all = Object.keys(QueryBuilders);
	const prefixMatches = all.filter((t) => t.toLowerCase().startsWith(lower));
	const substringMatches = all.filter(
		(t) => !prefixMatches.includes(t) && t.toLowerCase().includes(lower)
	);
	return [...prefixMatches, ...substringMatches].slice(0, limit);
}

function createBuilder(
	request: QueryRequest,
	websiteDomain?: string | null,
	timezone?: string
) {
	const validated = QuerySchema.parse(request) as QueryRequest;
	const config = QueryBuilders[validated.type];
	if (!config) {
		const suggestions = suggestQueryTypes(validated.type);
		const hint = suggestions.length
			? ` Did you mean: ${suggestions.join(", ")}?`
			: " Call the 'capabilities' tool with include=['queryTypes'] to see all available types.";
		throw new Error(`Unknown query type: ${validated.type}.${hint}`);
	}
	return new SimpleQueryBuilder(
		config,
		{ ...validated, timezone: timezone ?? validated.timezone },
		websiteDomain
	);
}

export const executeQuery = async (
	request: QueryRequest,
	websiteDomain?: string | null,
	timezone?: string
) => createBuilder(request, websiteDomain, timezone).execute();

export const compileQuery = (
	request: QueryRequest,
	websiteDomain?: string | null,
	timezone?: string
) => createBuilder(request, websiteDomain, timezone).compile();

export {
	areQueriesCompatible,
	executeBatch,
	getCompatibleQueries,
	getSchemaGroups,
} from "./batch-executor";
export * from "./builders";
export * from "./expressions";
export * from "./types";
