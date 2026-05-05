export type EvalCategory =
	| "tool-routing"
	| "behavioral"
	| "quality"
	| "format"
	| "attribution";

export type EvalSurface = "agent" | "mcp" | "slack";
export type EvalRunner = "api" | "package";

export interface ToolInputExpectation {
	excludes?: string[];
	includes?: Record<string, unknown>;
	tool: string;
}

export interface EvalCase {
	category: EvalCategory;
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
		minQualityScore?: number;
		confirmationFlow?: boolean;
		toolInputs?: ToolInputExpectation[];
	};
	id: string;
	name: string;
	query: string;
	surfaces?: EvalSurface[];
	tags?: string[];
	websiteId: string;
}

export interface ScoreCard {
	behavioral: number;
	format: number;
	performance: number;
	quality: number;
	tool_routing: number;
}

export interface CaseMetrics {
	costUsd: number;
	inputTokens: number;
	judgeCostUsd: number;
	latencyMs: number;
	outputTokens: number;
	steps: number;
}

export interface ToolCallRecord {
	index: number;
	input: unknown;
	name: string;
	output: unknown;
}

export interface CaseResult {
	category: string;
	failures: string[];
	id: string;
	metrics: CaseMetrics;
	name: string;
	passed: boolean;
	qualityDetail?: JudgeScores;
	query: string;
	response: string;
	scores: Partial<ScoreCard>;
	surfaces?: EvalSurface[];
	tags?: string[];
	toolCalls: ToolCallRecord[];
	toolsCalled: string[];
	warnings: string[];
}

export interface EvalRun {
	apiUrl: string;
	cases: CaseResult[];
	dimensions: ScoreCard;
	duration: number;
	filters?: {
		categories?: string[];
		excludeTags?: string[];
		surfaces?: Array<EvalSurface | "all">;
		tags?: string[];
	};
	judgeModel?: string;
	model: string;
	runner: EvalRunner;
	summary: {
		total: number;
		passed: number;
		failed: number;
		score: number;
	};
	timestamp: string;
}

export interface JudgeScores {
	actionability: number;
	analyticalDepth: number;
	average: number;
	communication: number;
	completeness: number;
	dataGrounding: number;
	explanation?: string;
}

export interface ParsedAgentResponse {
	chartJSONs: Array<{ type: string; raw: string; parsed: unknown }>;
	inputTokens: number;
	latencyMs: number;
	outputTokens: number;
	rawJSONLeaks: string[];
	steps: number;
	textContent: string;
	toolCalls: ToolCallRecord[];
}

export interface JudgeResult {
	scores: JudgeScores;
	usage: { inputTokens: number; outputTokens: number };
}

export interface EvalConfig {
	apiKey?: string;
	apiUrl: string;
	authCookie?: string;
	judgeModel?: string;
	modelOverride?: string;
	runner: EvalRunner;
	surface?: EvalSurface | "all";
}
