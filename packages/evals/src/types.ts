export type EvalCategory = "tool-routing" | "behavioral" | "quality" | "format";

export interface EvalCase {
	id: string;
	category: EvalCategory;
	name: string;
	query: string;
	websiteId: string;
	model?: "basic" | "agent" | "agent-max";
	expect: {
		toolsCalled?: string[];
		toolsNotCalled?: string[];
		batchedQueries?: boolean;
		responseContains?: string[];
		responseNotContains?: string[];
		chartType?: string;
		validChartJSON?: boolean;
		noRawJSON?: boolean;
		maxSteps?: number;
		maxLatencyMs?: number;
		maxInputTokens?: number;
		confirmationFlow?: boolean;
	};
}

export interface ScoreCard {
	tool_routing: number;
	behavioral: number;
	quality: number;
	format: number;
	performance: number;
}

export interface CaseMetrics {
	steps: number;
	latencyMs: number;
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
}

export interface CaseResult {
	id: string;
	category: string;
	name: string;
	passed: boolean;
	scores: Partial<ScoreCard>;
	metrics: CaseMetrics;
	toolsCalled: string[];
	failures: string[];
	response?: string;
}

export interface EvalRun {
	timestamp: string;
	model: string;
	apiUrl: string;
	duration: number;
	summary: {
		total: number;
		passed: number;
		failed: number;
		score: number;
	};
	dimensions: ScoreCard;
	cases: CaseResult[];
}

export interface ParsedAgentResponse {
	textContent: string;
	toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
	chartJSONs: Array<{ type: string; raw: string; parsed: unknown }>;
	rawJSONLeaks: string[];
	steps: number;
	latencyMs: number;
}

export interface EvalConfig {
	apiUrl: string;
	authCookie?: string;
	apiKey?: string;
	judgeModel?: string;
	skipJudge: boolean;
}
