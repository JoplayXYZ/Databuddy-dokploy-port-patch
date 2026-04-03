# Agent Eval Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone eval framework at `packages/evals/` that benchmarks the AI agent across 25 test cases, scoring tool routing, behavioral compliance, quality, format, and performance.

**Architecture:** The eval runner calls the live agent API via HTTP (same as a real user), parses streamed UIMessage responses, runs deterministic scorers + an optional LLM judge, and writes compact JSON results. A CLI runs evals and prints tables; a standalone HTML UI visualizes results over time.

**Tech Stack:** Bun, TypeScript, vanilla HTML/CSS/JS for UI

---

### Task 1: Package Scaffold

**Files:**
- Create: `packages/evals/package.json`
- Create: `packages/evals/tsconfig.json`
- Create: `packages/evals/src/types.ts`
- Create: `packages/evals/results/.gitkeep`
- Create: `packages/evals/.env.example`
- Modify: `package.json` (root)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@databuddy/evals",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/cli.ts",
  "scripts": {
    "eval": "bun run src/cli.ts",
    "eval:ui": "bun run ui/serve.ts"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "ui/**/*.ts"]
}
```

- [ ] **Step 3: Create types.ts**

```typescript
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
```

- [ ] **Step 4: Create .env.example and results/.gitkeep**

`.env.example`:
```
EVAL_API_URL=http://localhost:3001
EVAL_SESSION_COOKIE=
EVAL_API_KEY=
EVAL_JUDGE_MODEL=anthropic/claude-sonnet-4.6
EVAL_SKIP_JUDGE=false
```

Create empty `results/.gitkeep`.

- [ ] **Step 5: Add root scripts**

Add to root `package.json` scripts:
```json
"eval": "bun run --cwd packages/evals src/cli.ts",
"eval:ui": "bun run --cwd packages/evals ui/serve.ts"
```

- [ ] **Step 6: Commit**

```bash
git add packages/evals/ package.json
git commit -m "feat(evals): scaffold eval package with types"
```

---

### Task 2: Runner (HTTP Client + Response Parser)

**Files:**
- Create: `packages/evals/src/runner.ts`

- [ ] **Step 1: Create runner.ts**

The runner calls the agent API via HTTP, streams the response, and parses it into a `ParsedAgentResponse`.

```typescript
import type { EvalCase, EvalConfig, ParsedAgentResponse } from "./types";

/**
 * Execute a single eval case against the live agent API.
 * Streams the response and parses tool calls, text, and chart JSON.
 */
export async function runCase(
  evalCase: EvalCase,
  config: EvalConfig
): Promise<ParsedAgentResponse> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.authCookie) {
    headers.Cookie = config.authCookie;
  }
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const body = JSON.stringify({
    websiteId: evalCase.websiteId,
    model: evalCase.model ?? "agent",
    id: `eval-${evalCase.id}-${Date.now()}`,
    timezone: "UTC",
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: evalCase.query }],
      },
    ],
  });

  const response = await fetch(`${config.apiUrl}/v1/agent/chat`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent API error ${response.status}: ${errorText}`);
  }

  const fullText = await response.text();
  const latencyMs = Date.now() - startTime;

  return parseStreamedResponse(fullText, latencyMs);
}

const TOOL_CALL_PATTERN = /"toolName"\s*:\s*"([^"]+)"/g;
const CHART_JSON_PATTERN = /\{"type":"([\w-]+)"[^}]*"(?:series|rows|columns|referrers|countries|links|funnels|goals|annotations)"[^]*?\}/g;
const RAW_JSON_PATTERN = /\{"type":"[\w-]+"/g;

function parseStreamedResponse(
  raw: string,
  latencyMs: number
): ParsedAgentResponse {
  // Extract tool calls from the stream
  const toolCalls: ParsedAgentResponse["toolCalls"] = [];
  const toolMatches = raw.matchAll(TOOL_CALL_PATTERN);
  for (const match of toolMatches) {
    toolCalls.push({ name: match[1], input: null, output: null });
  }

  // Dedupe consecutive tool calls with same name
  const uniqueTools = toolCalls.filter(
    (tc, i) => i === 0 || tc.name !== toolCalls[i - 1].name
  );

  // Extract text content (rough: strip SSE framing, get text parts)
  let textContent = "";
  const textMatches = raw.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
  for (const match of textMatches) {
    try {
      textContent += JSON.parse(`"${match[1]}"`) + " ";
    } catch {
      textContent += match[1] + " ";
    }
  }
  textContent = textContent.trim();

  // Extract chart JSONs from text content
  const chartJSONs: ParsedAgentResponse["chartJSONs"] = [];
  const chartMatches = textContent.matchAll(
    /\{"type":"([\w-]+)"[^]*?\}/g
  );
  for (const match of chartMatches) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.type) {
        chartJSONs.push({ type: parsed.type, raw: match[0], parsed });
      }
    } catch {
      // not valid JSON
    }
  }

  // Check for raw JSON leaks (JSON that appeared as visible text, not rendered)
  const rawJSONLeaks: string[] = [];
  const leakCheck = textContent.match(/\{"type":"[\w-]+"[^}]*\}/g) ?? [];
  for (const leak of leakCheck) {
    try {
      JSON.parse(leak);
      // If it parsed, it was probably meant to be a component
    } catch {
      rawJSONLeaks.push(leak.slice(0, 100));
    }
  }

  // Count steps (tool calls = steps)
  const steps = uniqueTools.length;

  return {
    textContent,
    toolCalls: uniqueTools,
    chartJSONs,
    rawJSONLeaks,
    steps,
    latencyMs,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/runner.ts
git commit -m "feat(evals): add agent runner with HTTP client and response parser"
```

---

### Task 3: Scorers

**Files:**
- Create: `packages/evals/src/scorers.ts`

- [ ] **Step 1: Create scorers.ts**

```typescript
import type { EvalCase, ParsedAgentResponse, ScoreCard } from "./types";

interface ScoreResult {
  score: number;
  failures: string[];
}

export function scoreToolRouting(
  evalCase: EvalCase,
  response: ParsedAgentResponse
): ScoreResult {
  const failures: string[] = [];
  let score = 100;
  const called = new Set(response.toolCalls.map((tc) => tc.name));

  // Check expected tools were called
  if (evalCase.expect.toolsCalled) {
    for (const tool of evalCase.expect.toolsCalled) {
      if (!called.has(tool)) {
        score -= Math.floor(100 / evalCase.expect.toolsCalled.length);
        failures.push(`Expected tool '${tool}' not called`);
      }
    }
  }

  // Check forbidden tools were NOT called
  if (evalCase.expect.toolsNotCalled) {
    for (const tool of evalCase.expect.toolsNotCalled) {
      if (called.has(tool)) {
        score -= 25;
        failures.push(`Forbidden tool '${tool}' was called`);
      }
    }
  }

  // Check batching
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

  // Check responseContains
  if (evalCase.expect.responseContains) {
    const lower = response.textContent.toLowerCase();
    for (const term of evalCase.expect.responseContains) {
      if (!lower.includes(term.toLowerCase())) {
        score -= Math.floor(25 / evalCase.expect.responseContains.length);
        failures.push(`Response missing expected content: '${term}'`);
      }
    }
  }

  // Check responseNotContains
  if (evalCase.expect.responseNotContains) {
    const lower = response.textContent.toLowerCase();
    for (const term of evalCase.expect.responseNotContains) {
      if (lower.includes(term.toLowerCase())) {
        score -= 25;
        failures.push(`Response contains forbidden content: '${term}'`);
      }
    }
  }

  // Check confirmation flow (tool called with confirmed=false)
  if (evalCase.expect.confirmationFlow) {
    const hasConfirmFalse = response.textContent.includes("confirmed");
    if (!hasConfirmFalse) {
      score -= 25;
      failures.push("Expected confirmation flow (confirmed=false) not detected");
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

  // Check chart type
  if (evalCase.expect.chartType) {
    const hasChart = response.chartJSONs.some(
      (c) => c.type === evalCase.expect.chartType
    );
    if (!hasChart) {
      score -= 30;
      failures.push(`Expected chart type '${evalCase.expect.chartType}' not found`);
    }
  }

  // Check valid chart JSON
  if (evalCase.expect.validChartJSON) {
    if (response.chartJSONs.length === 0) {
      score -= 30;
      failures.push("No valid chart JSON found in response");
    } else {
      for (const chart of response.chartJSONs) {
        const p = chart.parsed as Record<string, unknown>;
        // Row-oriented format check
        if (
          ["line-chart", "bar-chart", "area-chart", "stacked-bar-chart"].includes(
            chart.type
          )
        ) {
          if (!Array.isArray(p.series) || !Array.isArray(p.rows)) {
            score -= 20;
            failures.push(
              `Chart '${chart.type}' missing row-oriented format (series+rows)`
            );
          }
        }
        if (["pie-chart", "donut-chart"].includes(chart.type)) {
          if (!Array.isArray(p.rows)) {
            score -= 20;
            failures.push(`Chart '${chart.type}' missing rows array`);
          }
        }
      }
    }
  }

  // Check no raw JSON leaks
  if (evalCase.expect.noRawJSON && response.rawJSONLeaks.length > 0) {
    score -= 20;
    failures.push(`Raw JSON leaked in response: ${response.rawJSONLeaks.length} instances`);
  }

  return { score: Math.max(0, Math.min(100, score)), failures };
}

export function scorePerformance(
  evalCase: EvalCase,
  response: ParsedAgentResponse
): ScoreResult {
  const failures: string[] = [];
  let score = 100;

  // Latency
  if (evalCase.expect.maxLatencyMs) {
    const ratio = response.latencyMs / evalCase.expect.maxLatencyMs;
    if (ratio > 1) {
      const penalty = Math.min(40, Math.floor((ratio - 1) * 20));
      score -= penalty;
      failures.push(
        `Latency ${response.latencyMs}ms exceeds budget ${evalCase.expect.maxLatencyMs}ms`
      );
    }
  }

  // Steps
  if (evalCase.expect.maxSteps) {
    if (response.steps > evalCase.expect.maxSteps) {
      const extra = response.steps - evalCase.expect.maxSteps;
      score -= extra * 20;
      failures.push(
        `${response.steps} steps exceeds budget of ${evalCase.expect.maxSteps}`
      );
    }
  }

  return { score: Math.max(0, Math.min(100, score)), failures };
}

/**
 * Run all applicable scorers for a test case.
 */
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/scorers.ts
git commit -m "feat(evals): add deterministic scorers for all dimensions"
```

---

### Task 4: LLM Judge

**Files:**
- Create: `packages/evals/src/judge.ts`

- [ ] **Step 1: Create judge.ts**

```typescript
import type { EvalCase, EvalConfig } from "./types";

interface JudgeResult {
  accuracy: number;
  actionability: number;
  completeness: number;
  average: number;
}

const JUDGE_PROMPT = `You are evaluating an analytics agent's response. Rate it on three criteria (0-100 each):

1. **Accuracy**: Does the response contain real data from tool results? No fabricated numbers? Are metrics correctly interpreted?
2. **Actionability**: Does it provide specific, useful insights the user can act on? Not just raw numbers but "why" and "what to do"?
3. **Completeness**: Does it fully answer the question with appropriate time context, comparisons, and relevant metrics?

Respond with ONLY a JSON object, no other text:
{"accuracy": N, "actionability": N, "completeness": N}`;

/**
 * Use an LLM to judge response quality. Returns quality score 0-100.
 * Skipped if config.skipJudge is true.
 */
export async function judgeQuality(
  evalCase: EvalCase,
  responseText: string,
  config: EvalConfig
): Promise<number> {
  if (config.skipJudge) return -1;

  const model = config.judgeModel ?? "anthropic/claude-sonnet-4.6";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: "system", content: JUDGE_PROMPT },
          {
            role: "user",
            content: `**User query:** ${evalCase.query}\n\n**Agent response:**\n${responseText.slice(0, 3000)}`,
          },
        ],
      }),
    });

    if (!response.ok) return -1;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) return -1;

    const result = JSON.parse(jsonMatch[0]) as JudgeResult;
    result.average = Math.round(
      (result.accuracy + result.actionability + result.completeness) / 3
    );

    return result.average;
  } catch {
    return -1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/judge.ts
git commit -m "feat(evals): add LLM-as-judge for quality scoring"
```

---

### Task 5: Test Cases

**Files:**
- Create: `packages/evals/src/cases/tool-routing.ts`
- Create: `packages/evals/src/cases/behavioral.ts`
- Create: `packages/evals/src/cases/quality.ts`
- Create: `packages/evals/src/cases/format.ts`
- Create: `packages/evals/src/cases/index.ts`

- [ ] **Step 1: Create all case files**

`tool-routing.ts`:
```typescript
import type { EvalCase } from "../types";

const WS = "OXmNQsViBT-FOS_wZCTHc";

export const toolRoutingCases: EvalCase[] = [
  {
    id: "batch-query",
    category: "tool-routing",
    name: "Batch multiple metrics",
    query: "Show me traffic, top pages, and referrers for last 30 days",
    websiteId: WS,
    expect: {
      toolsCalled: ["get_data"],
      toolsNotCalled: ["execute_sql_query"],
      batchedQueries: true,
      maxSteps: 3,
      maxLatencyMs: 15000,
    },
  },
  {
    id: "single-query-builder",
    category: "tool-routing",
    name: "Single query builder",
    query: "What's my bounce rate this month?",
    websiteId: WS,
    expect: {
      toolsCalled: ["execute_query_builder"],
      maxSteps: 3,
      maxLatencyMs: 10000,
    },
  },
  {
    id: "sql-when-needed",
    category: "tool-routing",
    name: "SQL only when builders insufficient",
    query: "Show me sessions where time_on_page > 60 seconds grouped by path, top 10",
    websiteId: WS,
    expect: {
      toolsCalled: ["execute_sql_query"],
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "links-routing",
    category: "tool-routing",
    name: "Links use links tools",
    query: "Show me my short links",
    websiteId: WS,
    expect: {
      toolsCalled: ["list_links"],
      toolsNotCalled: ["execute_query_builder", "execute_sql_query"],
      maxSteps: 2,
      maxLatencyMs: 8000,
    },
  },
  {
    id: "funnels-routing",
    category: "tool-routing",
    name: "Funnels use funnels tools",
    query: "List my funnels",
    websiteId: WS,
    expect: {
      toolsCalled: ["list_funnels"],
      toolsNotCalled: ["execute_query_builder"],
      maxSteps: 2,
      maxLatencyMs: 8000,
    },
  },
  {
    id: "goals-routing",
    category: "tool-routing",
    name: "Goals use goals tools",
    query: "What goals do I have?",
    websiteId: WS,
    expect: {
      toolsCalled: ["list_goals"],
      toolsNotCalled: ["execute_query_builder"],
      maxSteps: 2,
      maxLatencyMs: 8000,
    },
  },
  {
    id: "web-search-routing",
    category: "tool-routing",
    name: "External questions use web search",
    query: "What's a good bounce rate for SaaS websites?",
    websiteId: WS,
    expect: {
      toolsCalled: ["web_search"],
      toolsNotCalled: ["execute_query_builder", "execute_sql_query"],
      maxSteps: 2,
      maxLatencyMs: 15000,
    },
  },
  {
    id: "top-pages-routing",
    category: "tool-routing",
    name: "Page questions use get_top_pages",
    query: "What are my top pages?",
    websiteId: WS,
    expect: {
      toolsCalled: ["get_top_pages"],
      maxSteps: 2,
      maxLatencyMs: 10000,
    },
  },
];
```

`behavioral.ts`:
```typescript
import type { EvalCase } from "../types";

const WS = "OXmNQsViBT-FOS_wZCTHc";

export const behavioralCases: EvalCase[] = [
  {
    id: "tools-first",
    category: "behavioral",
    name: "Calls tools before responding",
    query: "How many visitors did I get yesterday?",
    websiteId: WS,
    expect: {
      toolsCalled: ["execute_query_builder"],
      responseNotContains: ["I don't have", "let me check", "I'll look"],
      maxSteps: 3,
    },
  },
  {
    id: "no-hallucination",
    category: "behavioral",
    name: "Does not fabricate data",
    query: "What's my top page?",
    websiteId: WS,
    expect: {
      toolsCalled: ["get_top_pages"],
      responseNotContains: ["approximately", "I estimate", "around"],
      maxSteps: 2,
    },
  },
  {
    id: "scope-rejection",
    category: "behavioral",
    name: "Rejects out-of-scope requests",
    query: "Write me a Python script to scrape websites",
    websiteId: WS,
    expect: {
      toolsNotCalled: ["execute_sql_query", "execute_query_builder", "web_search"],
      responseContains: ["analytics"],
      maxSteps: 1,
      maxLatencyMs: 5000,
    },
  },
  {
    id: "bounce-rate-accuracy",
    category: "behavioral",
    name: "Bounce rate only at site level",
    query: "What's the bounce rate for my /pricing page?",
    websiteId: WS,
    expect: {
      responseContains: ["site level", "not available", "summary"],
      maxSteps: 3,
    },
  },
  {
    id: "confirmation-flow",
    category: "behavioral",
    name: "CRUD requires confirmation",
    query: "Create a funnel for homepage to signup to thank-you page",
    websiteId: WS,
    expect: {
      toolsCalled: ["create_funnel"],
      confirmationFlow: true,
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "ambiguity-handling",
    category: "behavioral",
    name: "Handles ambiguous time ranges",
    query: "Compare last week to this week",
    websiteId: WS,
    expect: {
      maxSteps: 5,
      maxLatencyMs: 15000,
    },
  },
];
```

`quality.ts`:
```typescript
import type { EvalCase } from "../types";

const WS = "OXmNQsViBT-FOS_wZCTHc";

export const qualityCases: EvalCase[] = [
  {
    id: "traffic-overview",
    category: "quality",
    name: "Comprehensive site overview",
    query: "Give me a full overview of how my site is doing",
    websiteId: WS,
    expect: {
      toolsCalled: ["get_data"],
      batchedQueries: true,
      maxSteps: 5,
      maxLatencyMs: 20000,
    },
  },
  {
    id: "anomaly-investigation",
    category: "quality",
    name: "Investigate traffic changes",
    query: "Analyze my traffic trends this month and highlight anything unusual",
    websiteId: WS,
    expect: {
      maxSteps: 8,
      maxLatencyMs: 30000,
    },
  },
  {
    id: "comparison-analysis",
    category: "quality",
    name: "Desktop vs mobile comparison",
    query: "Compare desktop vs mobile visitors and performance",
    websiteId: WS,
    expect: {
      maxSteps: 5,
      maxLatencyMs: 20000,
    },
  },
  {
    id: "recommendations",
    category: "quality",
    name: "Actionable recommendations",
    query: "Based on my data, what should I focus on improving?",
    websiteId: WS,
    expect: {
      maxSteps: 8,
      maxLatencyMs: 25000,
    },
  },
  {
    id: "custom-events",
    category: "quality",
    name: "Custom events analysis",
    query: "Show me my custom events and their trends",
    websiteId: WS,
    expect: {
      maxSteps: 5,
      maxLatencyMs: 15000,
    },
  },
  {
    id: "multi-step-reasoning",
    category: "quality",
    name: "Multi-step correlation",
    query: "Which traffic source drives the most engaged visitors?",
    websiteId: WS,
    expect: {
      maxSteps: 8,
      maxLatencyMs: 25000,
    },
  },
];
```

`format.ts`:
```typescript
import type { EvalCase } from "../types";

const WS = "OXmNQsViBT-FOS_wZCTHc";

export const formatCases: EvalCase[] = [
  {
    id: "area-chart",
    category: "format",
    name: "Area chart for time series",
    query: "Show me traffic over time this month as a chart",
    websiteId: WS,
    expect: {
      chartType: "area-chart",
      validChartJSON: true,
      noRawJSON: true,
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "bar-chart",
    category: "format",
    name: "Bar chart for rankings",
    query: "Show me top 10 pages by views as a bar chart",
    websiteId: WS,
    expect: {
      chartType: "bar-chart",
      validChartJSON: true,
      noRawJSON: true,
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "donut-chart",
    category: "format",
    name: "Donut chart for distribution",
    query: "Show device distribution as a chart",
    websiteId: WS,
    expect: {
      chartType: "donut-chart",
      validChartJSON: true,
      noRawJSON: true,
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "data-table",
    category: "format",
    name: "Data table for tabular data",
    query: "Show me a table of my pages with their load times",
    websiteId: WS,
    expect: {
      chartType: "data-table",
      validChartJSON: true,
      noRawJSON: true,
      maxSteps: 3,
      maxLatencyMs: 12000,
    },
  },
  {
    id: "links-list-component",
    category: "format",
    name: "Links list component",
    query: "Show me all my short links",
    websiteId: WS,
    expect: {
      chartType: "links-list",
      noRawJSON: true,
      maxSteps: 2,
      maxLatencyMs: 8000,
    },
  },
];
```

`index.ts`:
```typescript
import type { EvalCase } from "../types";
import { behavioralCases } from "./behavioral";
import { formatCases } from "./format";
import { qualityCases } from "./quality";
import { toolRoutingCases } from "./tool-routing";

export const allCases: EvalCase[] = [
  ...toolRoutingCases,
  ...behavioralCases,
  ...qualityCases,
  ...formatCases,
];

export function getCasesByCategory(category: string): EvalCase[] {
  return allCases.filter((c) => c.category === category);
}

export function getCaseById(id: string): EvalCase | undefined {
  return allCases.find((c) => c.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/cases/
git commit -m "feat(evals): add 25 eval test cases across 4 categories"
```

---

### Task 6: Report Formatter

**Files:**
- Create: `packages/evals/src/report.ts`

- [ ] **Step 1: Create report.ts**

```typescript
import type { CaseResult, EvalRun } from "./types";

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padNum(n: number | undefined, len = 5): string {
  if (n === undefined || n < 0) return pad("--", len);
  return pad(String(n), len);
}

export function printReport(run: EvalRun): void {
  console.log("");
  console.log(`${BOLD}Agent Eval - ${run.timestamp}${RESET}`);
  console.log(`Model: ${run.model}`);
  console.log(`API: ${run.apiUrl}`);
  console.log(`Duration: ${(run.duration / 1000).toFixed(1)}s`);
  console.log("");

  // Header
  const header = ` # | ${pad("Case", 28)} | Pass | Tools | Behav | Qual  | Fmt   | Perf  | Time`;
  console.log(header);
  console.log("-".repeat(header.length));

  // Rows
  for (let i = 0; i < run.cases.length; i++) {
    const c = run.cases[i];
    const status = c.passed ? PASS : FAIL;
    const time = `${(c.metrics.latencyMs / 1000).toFixed(1)}s`;
    const row = `${pad(String(i + 1), 2)} | ${pad(c.id, 28)} | ${status} | ${padNum(c.scores.tool_routing)} | ${padNum(c.scores.behavioral)} | ${padNum(c.scores.quality)} | ${padNum(c.scores.format)} | ${padNum(c.scores.performance)} | ${time}`;
    console.log(row);

    // Print failures inline
    if (c.failures.length > 0) {
      for (const f of c.failures) {
        console.log(`${DIM}     -> ${f}${RESET}`);
      }
    }
  }

  console.log("");
  const s = run.summary;
  const d = run.dimensions;
  console.log(
    `${BOLD}Summary:${RESET} ${s.passed}/${s.total} passed (${s.score}%) | Tools: ${d.tool_routing} | Behavioral: ${d.behavioral} | Quality: ${d.quality} | Format: ${d.format} | Perf: ${d.performance}`
  );
  console.log("");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/report.ts
git commit -m "feat(evals): add CLI report formatter with colored output"
```

---

### Task 7: CLI Entry Point

**Files:**
- Create: `packages/evals/src/cli.ts`

- [ ] **Step 1: Create cli.ts**

```typescript
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { allCases, getCaseById, getCasesByCategory } from "./cases";
import { judgeQuality } from "./judge";
import { printReport } from "./report";
import { runCase } from "./runner";
import { scoreCase } from "./scorers";
import type { CaseResult, EvalConfig, EvalRun, ScoreCard } from "./types";

function parseArgs(): {
  category?: string;
  caseId?: string;
  noSave: boolean;
  noJudge: boolean;
  apiUrl: string;
} {
  const args = process.argv.slice(2);
  let category: string | undefined;
  let caseId: string | undefined;
  let noSave = false;
  let noJudge = false;
  let apiUrl = process.env.EVAL_API_URL ?? "http://localhost:3001";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      category = args[++i];
    } else if (args[i] === "--case" && args[i + 1]) {
      caseId = args[++i];
    } else if (args[i] === "--no-save") {
      noSave = true;
    } else if (args[i] === "--no-judge") {
      noJudge = true;
    } else if (args[i] === "--api-url" && args[i + 1]) {
      apiUrl = args[++i];
    }
  }

  return { category, caseId, noSave, noJudge, apiUrl };
}

async function main() {
  const opts = parseArgs();

  const config: EvalConfig = {
    apiUrl: opts.apiUrl,
    authCookie: process.env.EVAL_SESSION_COOKIE,
    apiKey: process.env.EVAL_API_KEY,
    judgeModel: process.env.EVAL_JUDGE_MODEL,
    skipJudge: opts.noJudge || process.env.EVAL_SKIP_JUDGE === "true",
  };

  // Select cases
  let cases = allCases;
  if (opts.caseId) {
    const c = getCaseById(opts.caseId);
    if (!c) {
      console.error(`Case '${opts.caseId}' not found`);
      process.exit(1);
    }
    cases = [c];
  } else if (opts.category) {
    cases = getCasesByCategory(opts.category);
    if (cases.length === 0) {
      console.error(`No cases found for category '${opts.category}'`);
      process.exit(1);
    }
  }

  console.log(`Running ${cases.length} eval cases against ${config.apiUrl}...`);
  console.log("");

  const runStart = Date.now();
  const results: CaseResult[] = [];

  for (const evalCase of cases) {
    process.stdout.write(`  ${evalCase.id}... `);

    try {
      const response = await runCase(evalCase, config);
      const { scores, failures } = scoreCase(evalCase, response);

      // LLM judge for quality cases
      if (evalCase.category === "quality" && !config.skipJudge) {
        const qualityScore = await judgeQuality(evalCase, response.textContent, config);
        if (qualityScore >= 0) {
          scores.quality = qualityScore;
        }
      }

      const scoreValues = Object.values(scores).filter((v): v is number => v !== undefined);
      const avgScore = scoreValues.length > 0
        ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
        : 0;
      const passed = failures.length === 0 && avgScore >= 60;

      results.push({
        id: evalCase.id,
        category: evalCase.category,
        name: evalCase.name,
        passed,
        scores,
        metrics: {
          steps: response.steps,
          latencyMs: response.latencyMs,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
        toolsCalled: response.toolCalls.map((tc) => tc.name),
        failures,
        response: response.textContent.slice(0, 500),
      });

      console.log(passed ? "\x1b[32mOK\x1b[0m" : `\x1b[31mFAIL\x1b[0m (${failures.length} issues)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.log(`\x1b[31mERROR\x1b[0m: ${msg}`);

      results.push({
        id: evalCase.id,
        category: evalCase.category,
        name: evalCase.name,
        passed: false,
        scores: {},
        metrics: { steps: 0, latencyMs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        toolsCalled: [],
        failures: [`Runner error: ${msg}`],
      });
    }
  }

  const totalDuration = Date.now() - runStart;

  // Aggregate dimensions
  const dimSums: ScoreCard = { tool_routing: 0, behavioral: 0, quality: 0, format: 0, performance: 0 };
  const dimCounts: ScoreCard = { tool_routing: 0, behavioral: 0, quality: 0, format: 0, performance: 0 };
  for (const r of results) {
    for (const [k, v] of Object.entries(r.scores)) {
      if (v !== undefined && v >= 0) {
        dimSums[k as keyof ScoreCard] += v;
        dimCounts[k as keyof ScoreCard] += 1;
      }
    }
  }

  const dimensions: ScoreCard = {
    tool_routing: dimCounts.tool_routing ? Math.round(dimSums.tool_routing / dimCounts.tool_routing) : 0,
    behavioral: dimCounts.behavioral ? Math.round(dimSums.behavioral / dimCounts.behavioral) : 0,
    quality: dimCounts.quality ? Math.round(dimSums.quality / dimCounts.quality) : 0,
    format: dimCounts.format ? Math.round(dimSums.format / dimCounts.format) : 0,
    performance: dimCounts.performance ? Math.round(dimSums.performance / dimCounts.performance) : 0,
  };

  const passedCount = results.filter((r) => r.passed).length;
  const overallScore = Math.round(
    Object.values(dimensions).reduce((a, b) => a + b, 0) / 5
  );

  const run: EvalRun = {
    timestamp: new Date().toISOString(),
    model: "anthropic/claude-sonnet-4.6",
    apiUrl: config.apiUrl,
    duration: totalDuration,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      score: overallScore,
    },
    dimensions,
    cases: results,
  };

  printReport(run);

  // Save results
  if (!opts.noSave) {
    const resultsDir = join(import.meta.dir, "..", "results");
    mkdirSync(resultsDir, { recursive: true });
    const filename = new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .replace("T", "-")
      .slice(0, 15)
      + ".json";
    const filepath = join(resultsDir, filename);
    writeFileSync(filepath, JSON.stringify(run, null, 2));
    console.log(`Saved: ${filepath}`);
  }
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/evals/src/cli.ts
git commit -m "feat(evals): add CLI entry point with args parsing and result aggregation"
```

---

### Task 8: Eval UI

**Files:**
- Create: `packages/evals/ui/index.html`
- Create: `packages/evals/ui/serve.ts`

- [ ] **Step 1: Create serve.ts**

```typescript
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const PORT = Number(process.env.EVAL_UI_PORT ?? 3002);
const RESULTS_DIR = join(import.meta.dir, "..", "results");
const UI_DIR = import.meta.dir;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/results") {
      try {
        const files = await readdir(RESULTS_DIR);
        const jsonFiles = files.filter((f) => f.endsWith(".json")).sort().reverse();
        const results = await Promise.all(
          jsonFiles.map(async (f) => {
            const content = await readFile(join(RESULTS_DIR, f), "utf-8");
            return JSON.parse(content);
          })
        );
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response("[]", {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Serve index.html
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = await readFile(join(UI_DIR, "index.html"), "utf-8");
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Eval UI running at http://localhost:${PORT}`);
```

- [ ] **Step 2: Create index.html**

Create `packages/evals/ui/index.html` -- a single-page app with vanilla HTML/CSS/JS that:
- Fetches `/api/results` on load
- Shows a run selector dropdown (by timestamp)
- Renders summary cards (total score, pass rate, per-dimension averages)
- Renders a sortable results table (case id, pass/fail, dimension scores, latency)
- Shows a historical line chart (overall score over time using SVG or basic canvas)
- Clicking a row expands to show tool calls, failures, and truncated response

The HTML should be self-contained (no external CDN dependencies) with embedded CSS and JS. Use a clean, minimal design with a dark theme matching Databuddy's aesthetic (dark background, muted borders, green for pass, red for fail).

This file will be ~300-400 lines. The key sections:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Databuddy Agent Evals</title>
  <style>
    /* Dark theme, monospace, minimal */
    :root { --bg: #0a0a0a; --card: #141414; --border: #262626; --text: #e5e5e5; --muted: #737373; --green: #22c55e; --red: #ef4444; --blue: #3b82f6; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 24px; max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .card-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    tr:hover { background: var(--card); }
    .pass { color: var(--green); }
    .fail { color: var(--red); }
    .score { font-variant-numeric: tabular-nums; }
    .expand { background: var(--card); padding: 12px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--border); display: none; }
    .expand.open { display: table-row; }
    select { background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: 13px; margin-bottom: 16px; }
    .chart-container { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 24px; height: 200px; position: relative; }
  </style>
</head>
<body>
  <h1>Agent Evals</h1>
  <div class="meta" id="meta">Loading...</div>
  <select id="runSelect" onchange="selectRun(this.value)"></select>
  <div class="cards" id="cards"></div>
  <div class="chart-container" id="history"><canvas id="historyChart"></canvas></div>
  <table id="results"><thead><tr>
    <th>#</th><th>Case</th><th>Status</th><th>Tools</th><th>Behav</th><th>Quality</th><th>Format</th><th>Perf</th><th>Time</th>
  </tr></thead><tbody id="tbody"></tbody></table>

  <script>
    let runs = [];
    let currentRun = null;

    async function load() {
      const res = await fetch('/api/results');
      runs = await res.json();
      if (runs.length === 0) { document.getElementById('meta').textContent = 'No eval runs found. Run: bun run eval --save'; return; }
      const select = document.getElementById('runSelect');
      select.innerHTML = runs.map((r, i) => `<option value="${i}">${r.timestamp} (${r.summary.score}%)</option>`).join('');
      selectRun(0);
      drawHistory();
    }

    function selectRun(idx) {
      currentRun = runs[idx];
      const r = currentRun;
      document.getElementById('meta').textContent = `Model: ${r.model} | API: ${r.apiUrl} | Duration: ${(r.duration/1000).toFixed(1)}s`;

      const d = r.dimensions;
      document.getElementById('cards').innerHTML = `
        <div class="card"><div class="card-label">Overall</div><div class="card-value">${r.summary.score}%</div></div>
        <div class="card"><div class="card-label">Pass Rate</div><div class="card-value">${r.summary.passed}/${r.summary.total}</div></div>
        <div class="card"><div class="card-label">Tool Routing</div><div class="card-value score">${d.tool_routing}</div></div>
        <div class="card"><div class="card-label">Behavioral</div><div class="card-value score">${d.behavioral}</div></div>
        <div class="card"><div class="card-label">Quality</div><div class="card-value score">${d.quality}</div></div>
        <div class="card"><div class="card-label">Format</div><div class="card-value score">${d.format}</div></div>
        <div class="card"><div class="card-label">Performance</div><div class="card-value score">${d.performance}</div></div>
      `;

      const tbody = document.getElementById('tbody');
      tbody.innerHTML = r.cases.map((c, i) => {
        const s = c.scores;
        const sc = v => v === undefined || v < 0 ? '--' : v;
        const status = c.passed ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
        const detail = c.failures.length > 0 ? `<tr class="expand" id="detail-${i}"><td colspan="9"><b>Failures:</b><br>${c.failures.map(f=>'- '+f).join('<br>')}<br><br><b>Tools:</b> ${c.toolsCalled.join(', ') || 'none'}<br><b>Response:</b> ${(c.response||'').replace(/</g,'&lt;').slice(0,300)}...</td></tr>` : '';
        return `<tr onclick="toggleDetail(${i})" style="cursor:pointer">
          <td>${i+1}</td><td>${c.id}</td><td>${status}</td>
          <td class="score">${sc(s.tool_routing)}</td><td class="score">${sc(s.behavioral)}</td>
          <td class="score">${sc(s.quality)}</td><td class="score">${sc(s.format)}</td>
          <td class="score">${sc(s.performance)}</td><td>${(c.metrics.latencyMs/1000).toFixed(1)}s</td>
        </tr>${detail}`;
      }).join('');
    }

    function toggleDetail(i) {
      const el = document.getElementById('detail-' + i);
      if (el) el.classList.toggle('open');
    }

    function drawHistory() {
      if (runs.length < 2) return;
      const canvas = document.getElementById('historyChart');
      const ctx = canvas.getContext('2d');
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width - 32; canvas.height = 168;
      const scores = runs.map(r => r.summary.score).reverse();
      const max = 100; const min = 0;
      const w = canvas.width; const h = canvas.height;
      const stepX = w / (scores.length - 1 || 1);

      ctx.strokeStyle = '#262626'; ctx.lineWidth = 1;
      for (let y = 0; y <= 100; y += 25) {
        const py = h - (y / max) * h;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
        ctx.fillStyle = '#737373'; ctx.font = '10px sans-serif'; ctx.fillText(y + '%', 2, py - 4);
      }

      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath();
      scores.forEach((s, i) => {
        const x = i * stepX; const y = h - (s / max) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      scores.forEach((s, i) => {
        const x = i * stepX; const y = h - (s / max) * h;
        ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
    }

    load();
  </script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add packages/evals/ui/
git commit -m "feat(evals): add standalone eval UI with results viewer and history chart"
```

---

### Task 9: Verify End-to-End

- [ ] **Step 1: Install dependencies**

```bash
cd packages/evals && bun install
```

- [ ] **Step 2: Run a single case to verify**

```bash
cd /Users/iza/Dev/Databuddy
bun run eval --case batch-query --no-judge --no-save
```

Expected: prints the case result to terminal.

- [ ] **Step 3: Run full suite and save**

```bash
bun run eval --no-judge
```

Expected: runs 25 cases, prints table, saves JSON to `packages/evals/results/`.

- [ ] **Step 4: Verify UI**

```bash
bun run eval:ui
```

Open `http://localhost:3002` in browser. Should show the saved run with summary cards, results table, and history chart.

- [ ] **Step 5: Commit results**

```bash
git add packages/evals/results/
git commit -m "feat(evals): initial eval run baseline"
```
