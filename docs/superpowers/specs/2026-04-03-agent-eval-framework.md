# Agent Eval Framework

**Date:** 2026-04-03
**Status:** Approved

## Goal

Build a standalone evaluation framework for the Databuddy AI agent that measures tool routing, behavioral compliance, response quality, format correctness, and performance across a suite of predefined test cases. Results are stored as compact JSON files, viewable via CLI and a lightweight standalone UI.

## Non-Goals

- Integration with the dashboard app or its build system
- Production monitoring or alerting
- Eval-as-a-service API endpoint
- Automated CI runs (can be added later, but not in scope)

---

## 1. Package Structure

```
packages/evals/
  src/
    cases/
      tool-routing.ts    # 8 cases: batch queries, SQL vs builder, links, funnels, etc.
      behavioral.ts      # 6 cases: tools-first, no hallucination, scope rejection, etc.
      quality.ts         # 6 cases: traffic overview, anomaly investigation, etc.
      format.ts          # 5 cases: area chart, bar chart, pie chart, data table, links-list
      index.ts           # exports all cases as a flat array
    runner.ts            # HTTP client: calls POST /v1/agent/chat, parses streamed response
    scorers.ts           # deterministic scoring functions per dimension
    judge.ts             # LLM-as-judge for quality dimension
    report.ts            # CLI output formatting (table + summary)
    types.ts             # EvalCase, EvalResult, EvalRun, ScoreCard types
    cli.ts               # entry point: parse args, run cases, score, save, print
  results/               # git-tracked JSON results (one file per run)
    .gitkeep
  ui/
    index.html           # single-page viewer: reads results/*.json, renders table + charts
  package.json
  tsconfig.json
```

Standalone package. No imports from `@databuddy/db`, `@databuddy/rpc`, or dashboard. The only interface is HTTP to a running API.

---

## 2. Types

```typescript
interface EvalCase {
  id: string;
  category: "tool-routing" | "behavioral" | "quality" | "format";
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

interface ScoreCard {
  tool_routing: number;   // 0-100
  behavioral: number;
  quality: number;
  format: number;
  performance: number;
}

interface CaseResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  scores: Partial<ScoreCard>;
  metrics: {
    steps: number;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  toolsCalled: string[];
  failures: string[];
  response?: string;       // truncated to 500 chars for storage
}

interface EvalRun {
  timestamp: string;       // ISO 8601
  model: string;
  apiUrl: string;
  duration: number;        // total run time in ms
  summary: {
    total: number;
    passed: number;
    failed: number;
    score: number;         // weighted average 0-100
  };
  dimensions: ScoreCard;   // averages across all cases
  cases: CaseResult[];
}
```

---

## 3. Runner

`runner.ts` sends real HTTP requests to the agent API:

- **Input:** An `EvalCase` and config (API URL, auth cookie/API key)
- **Output:** Parsed response with tool calls, text content, timing, token usage

Flow:
1. POST to `{apiUrl}/v1/agent/chat` with `{ websiteId, messages: [{ id, role: "user", parts: [{ type: "text", text: query }] }], model }`
2. Parse the streamed response (UIMessage format via SSE)
3. Extract: text parts, tool call parts (name, input, output), reasoning parts
4. Measure: total latency (request start to stream end), step count (number of tool calls)
5. Extract token usage from response headers or stream metadata if available

Authentication: pass a session cookie via `EVAL_SESSION_COOKIE` env var, or use an API key via `EVAL_API_KEY` env var with `Authorization: Bearer` header.

---

## 4. Scorers

`scorers.ts` contains deterministic scoring functions. Each takes a parsed response and the test case's `expect` object, returns a score 0-100 and a list of failure reasons.

### Tool Routing Score
- +25 for each expected tool called (proportional to expected count)
- -25 for each unexpected tool called from `toolsNotCalled`
- +25 if `batchedQueries` expected and `get_data` was called with multiple queries
- Floor at 0, cap at 100

### Behavioral Score
- tools-first: first content in response is a tool call, not text (25 pts)
- no hallucination phrases: response doesn't contain "I don't have data", "approximately", "I think", "let me estimate" (25 pts)
- responseContains: all required strings present (25 pts)
- responseNotContains: none of the forbidden strings present (25 pts)

### Format Score
- chartType match: response contains a chart JSON of the expected type (30 pts)
- validChartJSON: the chart JSON parses and has `series`+`rows` or `rows` as appropriate (30 pts)
- noRawJSON: no `{"type":"` strings appear in text segments (20 pts)
- row-oriented format: chart uses `rows` array not `data.x` (20 pts)

### Performance Score
- latency: 100 if under maxLatencyMs, linear decay to 0 at 3x the budget (40 pts weight)
- tokens: 100 if under maxInputTokens, linear decay (30 pts weight)
- steps: 100 if under maxSteps, -20 per extra step (30 pts weight)

### Quality Score (LLM-as-judge)
`judge.ts` sends the query + response to a judge model (configurable, default: same model) with a rubric:

```
Rate this analytics agent response on three criteria (0-100 each):
1. Accuracy: Does the response contain real data from tool results? No fabricated numbers?
2. Actionability: Does it provide specific, useful insights the user can act on?
3. Completeness: Does it fully answer the question with appropriate context?

Return JSON: {"accuracy": N, "actionability": N, "completeness": N}
```

Quality score = average of the three. Skipped if `EVAL_SKIP_JUDGE=true` (for fast runs).

---

## 5. Test Cases (~25 cases)

### Tool Routing (8 cases)
1. `batch-query`: "Show me traffic, top pages, and referrers" -> expects `get_data` with 3+ queries
2. `single-query-builder`: "What's my bounce rate?" -> expects `execute_query_builder` with `summary_metrics`
3. `sql-only-when-needed`: "Show me sessions where time_on_page > 60s grouped by path" -> expects `execute_sql_query`
4. `links-routing`: "Show me my links" -> expects `list_links`, NOT `execute_query_builder`
5. `funnels-routing`: "List my funnels" -> expects `list_funnels`
6. `goals-routing`: "What goals do I have?" -> expects `list_goals`
7. `web-search-routing`: "What's a good bounce rate for SaaS?" -> expects `web_search`
8. `memory-routing`: "What did we discuss last time?" -> expects `search_memory`

### Behavioral (6 cases)
9. `tools-first`: "How many visitors yesterday?" -> first response action must be tool call
10. `no-hallucination`: "What's my top page?" -> must call tool, not guess
11. `scope-rejection`: "Write me a Python script" -> must decline, redirect to analytics
12. `bounce-rate-accuracy`: "What's the bounce rate for /pricing?" -> must say per-page bounce unavailable
13. `confirmation-flow`: "Create a funnel for signup" -> must call with `confirmed=false` first
14. `ambiguity-handling`: "Compare last week to this week" -> should clarify or pick reasonable defaults

### Quality (6 cases)
15. `traffic-overview`: "Give me a full overview of my site" -> comprehensive multi-metric response
16. `anomaly-investigation`: "Why did my traffic drop?" -> multi-step investigation with synthesis
17. `comparison-analysis`: "Compare desktop vs mobile performance" -> comparative analysis
18. `recommendations`: "How can I improve my site?" -> actionable recommendations backed by data
19. `custom-events`: "Show me my custom events" -> uses custom_events_discovery
20. `multi-step-reasoning`: "Which referrer drives the most engaged visitors?" -> traffic + engagement correlation

### Format (5 cases)
21. `area-chart`: "Show me traffic over time this month" -> valid area-chart JSON with rows format
22. `bar-chart`: "Top 10 pages by views" -> valid bar-chart JSON
23. `donut-chart`: "Device distribution" -> valid donut-chart JSON
24. `data-table`: "Show me error details" -> valid data-table JSON with columns/rows
25. `links-list`: "List all my links" -> valid links-list JSON component

---

## 6. CLI

Entry point: `packages/evals/src/cli.ts`, run via `bun run eval` from repo root.

### Commands
- `bun run eval` -- run all 25 cases, print table, save to `results/`
- `bun run eval --category tool-routing` -- run one category
- `bun run eval --case batch-query` -- run one case
- `bun run eval --no-save` -- don't write results file
- `bun run eval --no-judge` -- skip LLM quality scoring (faster)
- `bun run eval --api-url http://localhost:3001` -- custom API URL

### Output
Terminal table:
```
Agent Eval - 2026-04-03 14:30:22
Model: anthropic/claude-sonnet-4.6
API: http://localhost:3001

 # | Case                    | Pass | Tools | Behav | Quality | Format | Perf  | Time
---|-------------------------|------|-------|-------|---------|--------|-------|-------
 1 | batch-query             |  OK  |  100  |  100  |   --    |   90   |   95  | 3.2s
 2 | single-query-builder    |  OK  |  100  |  100  |   --    |  100   |   90  | 2.1s
 3 | links-routing           | FAIL |   50  |  100  |   --    |   80   |   85  | 2.8s
...

Summary: 22/25 passed (88%) | Tools: 92 | Behavioral: 95 | Quality: 82 | Format: 90 | Perf: 85
Saved: results/2026-04-03-143022.json
```

### Root package.json scripts
```json
{
  "eval": "bun run --cwd packages/evals src/cli.ts",
  "eval:ui": "bun run --cwd packages/evals ui/serve.ts"
}
```

---

## 7. UI

Single HTML page at `packages/evals/ui/index.html` served by a minimal Bun file server (`ui/serve.ts`).

Reads all JSON files from `results/` directory. Renders:

- **Run selector**: dropdown of all runs by timestamp
- **Summary cards**: total score, pass rate, per-dimension averages
- **Results table**: sortable by any column, color-coded pass/fail
- **Historical chart**: line chart showing overall score + per-dimension scores over time (from all runs)
- **Case detail**: click a row to expand and see full response text, tool calls, timing breakdown

Built with vanilla HTML/CSS/JS -- no React, no build step. Reads JSON via fetch from the local server.

Served via `bun run eval:ui` on port 3002 (configurable).

---

## 8. Authentication for Eval

The eval runner needs to authenticate with the API. Two options:

1. **Session cookie**: Set `EVAL_SESSION_COOKIE` env var. Runner sends it as `Cookie` header. Works with existing Better-Auth sessions.
2. **API key**: Set `EVAL_API_KEY` env var. Runner sends as Bearer token. Requires an API key with `read:data` scope.

The eval package ships with an `.env.example`:
```
EVAL_API_URL=http://localhost:3001
EVAL_SESSION_COOKIE=
EVAL_API_KEY=
EVAL_JUDGE_MODEL=anthropic/claude-sonnet-4.6
EVAL_SKIP_JUDGE=false
```

---

## 9. Cost Estimation

Per full run (25 cases):
- ~25 agent calls, each using ~10-50K input tokens and ~1-5K output tokens
- With prompt caching: ~$0.50-$2.00 per run
- LLM judge adds ~$0.10-$0.30 (small prompts, 6 cases only)
- Total: ~$1-$3 per full eval run
- Duration: ~2-5 minutes (sequential, no parallelism to avoid rate limits)
