import type { Insight, InsightMetric, InsightType } from "@/lib/insight-types";

const METRIC_LABEL_REPLACEMENTS: Array<[RegExp, string]> = [
	[/\bINP\b/i, "Interaction delay"],
	[/\bLCP\b/i, "Load speed"],
	[/\bFCP\b/i, "First visual load"],
	[/\bTTFB\b/i, "Server response"],
	[/\bCLS\b/i, "Layout stability"],
	[/\bp75\b/i, ""],
	[/\bpageviews?\b/i, "Page views"],
	[/\bsessions?\b/i, "Sessions"],
	[/\bvisitors?\b/i, "Visitors"],
	[/\bbounce rate\b/i, "Bounce rate"],
	[/\berror rate\b/i, "Error rate"],
];

const DEFAULT_PRIMARY_ACTION_LABEL = "Open analytics";

const PRIMARY_ACTION_LABELS: Partial<Record<InsightType, string>> = {
	bounce_rate_change: "Review traffic quality",
	channel_concentration: "Compare channels",
	conversion_leak: "Inspect funnel",
	cross_property_dependency: "Review traffic path",
	engagement_change: "Review sessions",
	error_spike: "Review errors",
	funnel_regression: "Inspect funnel",
	new_errors: "Review errors",
	page_trend: "Review page",
	performance: "Review speed",
	performance_improved: "Review speed",
	persistent_error_hotspot: "Review errors",
	quality_shift: "Review sessions",
	referrer_change: "Compare referrers",
	reliability_improved: "Review errors",
	traffic_drop: "Review traffic",
	traffic_spike: "Review traffic",
	uptime_issue: "Review uptime",
	vitals_degraded: "Review speed",
};

export interface InsightEvidenceMetric extends InsightMetric {
	displayLabel: string;
	rawLabel: string;
}

export interface InsightCardViewModel {
	evidence: InsightEvidenceMetric[];
	headline: string;
	metaLabel: string;
	nextStep: string;
	primaryActionLabel: string;
	whyItMatters: string;
}

export function humanizeInsightMetricLabel(label: string): string {
	let next = label.trim();

	for (const [pattern, replacement] of METRIC_LABEL_REPLACEMENTS) {
		next = next.replace(pattern, replacement);
	}

	return next.replace(/\s+/g, " ").trim() || label;
}

export function toInsightCardViewModel(insight: Insight): InsightCardViewModel {
	const evidence = (insight.metrics ?? []).map((metric) => ({
		...metric,
		displayLabel: humanizeInsightMetricLabel(metric.label),
		rawLabel: metric.label,
	}));

	return {
		evidence,
		headline: insight.title,
		metaLabel: insight.websiteName ?? insight.websiteDomain,
		nextStep: insight.suggestion,
		primaryActionLabel:
			PRIMARY_ACTION_LABELS[insight.type] ?? DEFAULT_PRIMARY_ACTION_LABEL,
		whyItMatters: insight.description,
	};
}
