import type { EvalCase, ParsedAgentResponse, ScoreCard } from "./types";

interface ScoreResult {
	failures: string[];
	score: number;
}

export function scoreToolRouting(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): ScoreResult {
	const failures: string[] = [];
	let score = 100;
	const called = new Set(response.toolCalls.map((tc) => tc.name));

	if (evalCase.expect.toolsCalled) {
		for (const tool of evalCase.expect.toolsCalled) {
			if (!called.has(tool)) {
				score -= Math.floor(100 / evalCase.expect.toolsCalled.length);
				failures.push(`Expected tool '${tool}' not called`);
			}
		}
	}

	if (evalCase.expect.toolsNotCalled) {
		for (const tool of evalCase.expect.toolsNotCalled) {
			if (called.has(tool)) {
				score -= 25;
				failures.push(`Forbidden tool '${tool}' was called`);
			}
		}
	}

	if (evalCase.expect.batchedQueries && !called.has("get_data")) {
		score -= 25;
		failures.push("Expected batched queries via get_data");
	}

	return { score: Math.max(0, Math.min(100, score)), failures };
}

export function scoreBehavioral(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): ScoreResult {
	const failures: string[] = [];
	let score = 100;

	if (evalCase.expect.responseContains) {
		const lower = response.textContent.toLowerCase();
		for (const term of evalCase.expect.responseContains) {
			if (!lower.includes(term.toLowerCase())) {
				score -= Math.floor(25 / evalCase.expect.responseContains.length);
				failures.push(`Response missing expected content: '${term}'`);
			}
		}
	}

	if (evalCase.expect.responseNotContains) {
		const lower = response.textContent.toLowerCase();
		for (const term of evalCase.expect.responseNotContains) {
			if (lower.includes(term.toLowerCase())) {
				score -= 25;
				failures.push(`Response contains forbidden content: '${term}'`);
			}
		}
	}

	if (evalCase.expect.confirmationFlow) {
		const hasConfirmFalse = response.textContent.includes("confirmed");
		if (!hasConfirmFalse) {
			score -= 25;
			failures.push(
				"Expected confirmation flow (confirmed=false) not detected"
			);
		}
	}

	return { score: Math.max(0, Math.min(100, score)), failures };
}

export function scoreFormat(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): ScoreResult {
	const failures: string[] = [];
	let score = 100;

	if (evalCase.expect.chartType) {
		const hasChart = response.chartJSONs.some(
			(c) => c.type === evalCase.expect.chartType
		);
		if (!hasChart) {
			score -= 30;
			failures.push(
				`Expected chart type '${evalCase.expect.chartType}' not found`
			);
		}
	}

	if (evalCase.expect.validChartJSON) {
		if (response.chartJSONs.length === 0) {
			score -= 30;
			failures.push("No valid chart JSON found in response");
		} else {
			for (const chart of response.chartJSONs) {
				const p = chart.parsed as Record<string, unknown>;
				if (
					[
						"line-chart",
						"bar-chart",
						"area-chart",
						"stacked-bar-chart",
					].includes(chart.type) &&
					!(Array.isArray(p.series) && Array.isArray(p.rows))
				) {
					score -= 20;
					failures.push(
						`Chart '${chart.type}' missing row-oriented format (series+rows)`
					);
				}
				if (
					["pie-chart", "donut-chart"].includes(chart.type) &&
					!Array.isArray(p.rows)
				) {
					score -= 20;
					failures.push(`Chart '${chart.type}' missing rows array`);
				}
			}
		}
	}

	if (evalCase.expect.noRawJSON && response.rawJSONLeaks.length > 0) {
		score -= 20;
		failures.push(
			`Raw JSON leaked in response: ${response.rawJSONLeaks.length} instances`
		);
	}

	return { score: Math.max(0, Math.min(100, score)), failures };
}

export function scorePerformance(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): ScoreResult {
	const failures: string[] = [];
	let score: number;

	const ms = response.latencyMs;
	if (ms < 60_000) {
		score = 100;
	} else if (ms < 120_000) {
		score = 90;
	} else if (ms < 180_000) {
		score = 80;
	} else if (ms < 300_000) {
		score = 70;
	} else if (ms < 600_000) {
		score = 50;
	} else {
		score = 0;
	}

	if (evalCase.expect.maxLatencyMs && ms > evalCase.expect.maxLatencyMs) {
		failures.push(
			`Latency ${ms}ms exceeds budget ${evalCase.expect.maxLatencyMs}ms`
		);
	}

	if (evalCase.expect.maxSteps && response.steps > evalCase.expect.maxSteps) {
		const extra = response.steps - evalCase.expect.maxSteps;
		score = Math.max(0, score - extra * 10);
		failures.push(
			`${response.steps} steps exceeds budget of ${evalCase.expect.maxSteps}`
		);
	}

	return { score: Math.max(0, Math.min(100, score)), failures };
}

export function scoreCase(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): { scores: Partial<ScoreCard>; failures: string[] } {
	const allFailures: string[] = [];
	const scores: Partial<ScoreCard> = {};

	const tr = scoreToolRouting(evalCase, response);
	scores.tool_routing = tr.score;
	allFailures.push(...tr.failures);

	const bh = scoreBehavioral(evalCase, response);
	scores.behavioral = bh.score;
	allFailures.push(...bh.failures);

	const fm = scoreFormat(evalCase, response);
	scores.format = fm.score;
	allFailures.push(...fm.failures);

	const pf = scorePerformance(evalCase, response);
	scores.performance = pf.score;
	allFailures.push(...pf.failures);

	return { scores, failures: allFailures };
}
