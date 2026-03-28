import { VALIDATION_LIMITS } from "@utils/validation";
import { z } from "zod";

export const trackEventSchema = z.union([
	z.object({
		name: z.string().min(1).max(256),
		namespace: z.string().max(64).optional(),
		timestamp: z.union([z.number(), z.string(), z.date()]).optional(),
		properties: z.record(z.string(), z.unknown()).optional(),
		anonymousId: z.string().max(256).optional(),
		sessionId: z.string().max(256).optional(),
		websiteId: z
			.string()
			.max(VALIDATION_LIMITS.SHORT_STRING_MAX_LENGTH)
			.optional(),
		source: z.string().max(64).optional(),
	}),
	z
		.array(
			z.object({
				name: z.string().min(1).max(256),
				namespace: z.string().max(64).optional(),
				timestamp: z.union([z.number(), z.string(), z.date()]).optional(),
				properties: z.record(z.string(), z.unknown()).optional(),
				anonymousId: z.string().max(256).optional(),
				sessionId: z.string().max(256).optional(),
				websiteId: z
					.string()
					.max(VALIDATION_LIMITS.SHORT_STRING_MAX_LENGTH)
					.optional(),
				source: z.string().max(64).optional(),
			})
		)
		.max(VALIDATION_LIMITS.BATCH_MAX_SIZE),
]);
