import type { EvalCase, ParsedAgentResponse, ScoreCard } from "./types";

interface ScoreResult {
	failures: string[];
	score: number;
	warnings?: string[];
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

	if (evalCase.expect.toolInputs) {
		for (const expectation of evalCase.expect.toolInputs) {
			const calls = response.toolCalls.filter(
				(call) => call.name === expectation.tool
			);
			if (calls.length === 0) {
				score -= 25;
				failures.push(
					`Expected tool '${expectation.tool}' input could not be checked because the tool was not called`
				);
				continue;
			}

			const matched = calls.some((call) =>
				toolInputMatches(call.input, expectation)
			);
			if (!matched) {
				score -= 25;
				failures.push(
					`No '${expectation.tool}' call matched expected input constraints`
				);
			}
		}
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
		const hasConfirmFalse =
			response.textContent.includes("confirmed") ||
			response.toolCalls.some((call) =>
				hasNestedValue(call.input, "confirmed", false)
			);
		if (!hasConfirmFalse) {
			score -= 25;
			failures.push(
				"Expected confirmation flow (confirmed=false) not detected"
			);
		}
	}

	return { score: Math.max(0, Math.min(100, score)), failures };
}

function toolInputMatches(
	input: unknown,
	expectation: NonNullable<EvalCase["expect"]["toolInputs"]>[number]
): boolean {
	if (expectation.excludes) {
		for (const key of expectation.excludes) {
			if (hasNestedKey(input, key)) {
				return false;
			}
		}
	}

	if (expectation.includes) {
		for (const [key, expected] of Object.entries(expectation.includes)) {
			if (!hasNestedValue(input, key, expected)) {
				return false;
			}
		}
	}

	return true;
}

function hasNestedKey(value: unknown, key: string): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}
	if (Object.hasOwn(value, key)) {
		return true;
	}
	return Object.values(value).some((child) => hasNestedKey(child, key));
}

function hasNestedValue(
	value: unknown,
	key: string,
	expected: unknown
): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}
	if (
		Object.hasOwn(value, key) &&
		(value as Record<string, unknown>)[key] === expected
	) {
		return true;
	}
	return Object.values(value).some((child) =>
		hasNestedValue(child, key, expected)
	);
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
	const warnings: string[] = [];
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
		warnings.push(
			`Latency ${ms}ms exceeds budget ${evalCase.expect.maxLatencyMs}ms`
		);
	}

	if (evalCase.expect.maxSteps && response.steps > evalCase.expect.maxSteps) {
		const extra = response.steps - evalCase.expect.maxSteps;
		score = Math.max(0, score - extra * 10);
		warnings.push(
			`${response.steps} steps exceeds budget of ${evalCase.expect.maxSteps}`
		);
	}

	return { score: Math.max(0, Math.min(100, score)), failures: [], warnings };
}

export function scoreCase(
	evalCase: EvalCase,
	response: ParsedAgentResponse
): { scores: Partial<ScoreCard>; failures: string[]; warnings: string[] } {
	const allFailures: string[] = [];
	const allWarnings: string[] = [];
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
	if (pf.warnings) {
		allWarnings.push(...pf.warnings);
	}

	return { scores, failures: allFailures, warnings: allWarnings };
}
