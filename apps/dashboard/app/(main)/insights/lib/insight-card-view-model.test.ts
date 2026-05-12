import { describe, expect, it } from "bun:test";
import type { Insight } from "@/lib/insight-types";
import {
	humanizeInsightMetricLabel,
	toInsightCardViewModel,
} from "./insight-card-view-model";

const baseInsight: Insight = {
	id: "insight_1",
	type: "vitals_degraded",
	severity: "warning",
	sentiment: "negative",
	priority: 8,
	websiteId: "web_1",
	websiteName: "Marketing",
	websiteDomain: "databuddy.cc",
	title: "Interactions got slower",
	description: "Visitors are waiting longer after clicking key controls.",	suggestion: "Profile homepage JavaScript during real sessions.",	metrics: [
		{ label: "INP p75", current: 104, previous: 96, format: "duration_ms" },
	],
	changePercent: 8.3,
	link: "/websites/web_1",
};

describe("insight card view model", () => {
	it("humanizes technical metric labels", () => {
		expect(humanizeInsightMetricLabel("INP p75")).toBe("Interaction delay");
		expect(humanizeInsightMetricLabel("LCP p75")).toBe("Load speed");
		expect(humanizeInsightMetricLabel("TTFB p75")).toBe("Server response");
	});

	it("keeps raw metric labels as evidence metadata", () => {
		const view = toInsightCardViewModel(baseInsight);

		expect(view.headline).toBe("Interactions got slower");
		expect(view.metaLabel).toBe("Marketing");
		expect(view.primaryActionLabel).toBe("Review speed");
		expect(view.evidence[0]).toMatchObject({
			displayLabel: "Interaction delay",
			rawLabel: "INP p75",
		});
	});

	it("falls back to domain and default action when needed", () => {
		const view = toInsightCardViewModel({
			...baseInsight,
			type: "custom_event_spike",
			websiteName: null,
		});

		expect(view.metaLabel).toBe("databuddy.cc");
		expect(view.primaryActionLabel).toBe("Open analytics");
	});
});
