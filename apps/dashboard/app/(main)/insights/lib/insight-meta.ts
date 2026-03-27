import type { Insight } from "@/lib/insight-types";
import dayjs from "@/lib/dayjs";

/** Human-readable comparison window when DB persisted period fields exist. */
export function formatComparisonWindow(insight: Insight): string | null {
	const {
		currentPeriodFrom,
		currentPeriodTo,
		previousPeriodFrom,
		previousPeriodTo,
		timezone,
	} = insight;
	if (
		!(
			currentPeriodFrom &&
			currentPeriodTo &&
			previousPeriodFrom &&
			previousPeriodTo
		)
	) {
		return null;
	}
	const tz = timezone ? ` · ${timezone}` : "";
	return `Previous ${previousPeriodFrom}–${previousPeriodTo} vs current ${currentPeriodFrom}–${currentPeriodTo}${tz}`;
}

/** Short line for source + recency. */
export function formatInsightFreshness(insight: Insight): string {
	if (insight.insightSource === "ai") {
		return "Latest analysis";
	}
	if (insight.createdAt) {
		const d = dayjs(insight.createdAt);
		if (d.isValid()) {
			return `From history · ${d.fromNow()}`;
		}
	}
	return "From history";
}

export function buildInsightShareUrl(insightId: string): string {
	if (typeof window === "undefined") {
		return "";
	}
	const url = new URL(window.location.href);
	url.hash = `insight-${insightId}`;
	return url.toString();
}

export function buildInsightCopyText(insight: Insight): string {
	const lines = [
		insight.title,
		"",
		`${insight.websiteName ?? insight.websiteDomain}`,
		"",
		insight.description,
		"",
		`Suggestion: ${insight.suggestion}`,
	];
	const windowLine = formatComparisonWindow(insight);
	if (windowLine) {
		lines.push("", windowLine);
	}
	return lines.join("\n");
}
