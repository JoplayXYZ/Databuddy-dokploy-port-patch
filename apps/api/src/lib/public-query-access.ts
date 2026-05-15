import { QueryBuilders } from "@databuddy/ai/query/builders";

export function isPublicQueryAccess(queryTypes: string[]): boolean {
	return (
		queryTypes.length > 0 &&
		queryTypes.every((type) => QueryBuilders[type]?.publicAccess === true)
	);
}
