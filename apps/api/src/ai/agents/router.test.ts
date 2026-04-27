import { describe, expect, it } from "bun:test";
import {
	hasToolHistory,
	routeMessage,
	selectModelKeyForRoute,
} from "./router";

describe("agent route model selection", () => {
	it("uses the fast model for fresh simple messages", () => {
		const routeLabel = routeMessage("thanks");

		expect(routeLabel).toBe("simple");
		expect(
			selectModelKeyForRoute(routeLabel, [
				{ parts: [{ type: "text" }] },
			])
		).toBe("fast");
	});

	it("keeps tool-capable model for simple follow-ups with tool history", () => {
		const messages = [
			{ parts: [{ type: "text" }] },
			{
				parts: [
					{ type: "text" },
					{ type: "tool-get_data" },
				],
			},
			{ parts: [{ type: "text" }] },
		];
		const routeLabel = routeMessage("ok");

		expect(routeLabel).toBe("simple");
		expect(hasToolHistory(messages)).toBe(true);
		expect(selectModelKeyForRoute(routeLabel, messages)).toBe("analytics");
	});

	it("uses the analytics model for complex messages", () => {
		const routeLabel = routeMessage("compare traffic this week vs last week");

		expect(routeLabel).toBe("complex");
		expect(selectModelKeyForRoute(routeLabel, [])).toBe("analytics");
	});
});
