import { describe, expect, test } from "bun:test";
import { trackEventSchema } from "./track-event-schema";

describe("trackEventSchema", () => {
	test("accepts CDN data-track batch: signup_clicked with nanoid websiteId", () => {
		const payload = [
			{
				name: "signup_clicked",
				timestamp: 1_774_652_827_708,
				properties: {
					context: "home_hero",
					label: "Publish your first post",
				},
				anonymousId: "anon_7f3a9c2e1b8d4f6a0e5c3d9b2a8f1e4c",
				sessionId: "sess_4a8e1f9c2d7b3a6e0f5c8d2b9a3e7f1c",
				websiteId: "OXmNQsViBT-FOS_wZCTHc",
				source: "browser",
			},
		];

		const result = trackEventSchema.safeParse(payload);
		expect(result.success).toBe(true);
		if (result.success && Array.isArray(result.data)) {
			expect(result.data[0]?.name).toBe("signup_clicked");
			expect(result.data[0]?.websiteId).toBe("OXmNQsViBT-FOS_wZCTHc");
		}
	});

	test("still accepts UUID-shaped websiteId in body", () => {
		const payload = {
			name: "purchase",
			timestamp: 1_704_067_200_000,
			websiteId: "3ed1fce1-5a56-4cbc-a917-66864f6d18e3",
			source: "server",
		};
		const result = trackEventSchema.safeParse(payload);
		expect(result.success).toBe(true);
	});
});
