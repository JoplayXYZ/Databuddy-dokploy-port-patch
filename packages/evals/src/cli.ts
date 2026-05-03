import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allCases, getCaseById, getCasesByCategory } from "./cases";
import { judgeQuality } from "./judge";
import { printReport } from "./report";
import { runCase } from "./runner";
import type { ProgressEvent } from "./runner";
import { scoreCase } from "./scorers";
import type {
	CaseResult,
	EvalCase,
	EvalConfig,
	EvalRun,
	ScoreCard,
} from "./types";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const CLEAR_LINE = "\x1b[2K\r";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

interface CliOpts {
	apiUrl: string;
	caseId?: string;
	category?: string;
	concurrency: number;
	diff: boolean;
	file?: string;
	model?: string;
	noSave: boolean;
	rejudge: boolean;
	skipJudge: boolean;
	subcommand: "run" | "compare";
}

const STRUCTURAL_PASS_THRESHOLD = 60;
const DEFAULT_JUDGED_QUALITY_THRESHOLD = 60;
const QUALITY_GATE_FAILURE_PREFIX = "Quality judge score";

function shouldJudgeCase(evalCase: EvalCase): boolean {
	return evalCase.category === "quality" || evalCase.category === "attribution";
}

function averageScore(scores: Partial<ScoreCard>): number {
	const scoreValues = Object.values(scores).filter(
		(v): v is number => v !== undefined
	);
	return scoreValues.length > 0
		? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
		: 0;
}

function refreshCaseStatus(result: CaseResult, evalCase: EvalCase): void {
	result.failures = result.failures.filter(
		(f) => !f.startsWith(QUALITY_GATE_FAILURE_PREFIX)
	);

	const minQualityScore =
		evalCase.expect.minQualityScore ??
		(shouldJudgeCase(evalCase) ? DEFAULT_JUDGED_QUALITY_THRESHOLD : undefined);
	if (
		minQualityScore !== undefined &&
		result.scores.quality !== undefined &&
		result.scores.quality < minQualityScore
	) {
		result.failures.push(
			`${QUALITY_GATE_FAILURE_PREFIX} ${result.scores.quality} below required ${minQualityScore}`
		);
	}

	result.passed =
		result.failures.length === 0 &&
		averageScore(result.scores) >= STRUCTURAL_PASS_THRESHOLD;
}

function parseArgs(): CliOpts {
	const args = process.argv.slice(2);
	let subcommand: CliOpts["subcommand"] = "run";
	let category: string | undefined;
	let caseId: string | undefined;
	let model: string | undefined;
	let file: string | undefined;
	let noSave = false;
	let skipJudge = process.env.EVAL_SKIP_JUDGE === "true";
	let rejudge = false;
	let diff = false;
	let apiUrl = process.env.EVAL_API_URL ?? "http://localhost:3001";
	let concurrency = 10;

	if (args[0] === "compare") {
		subcommand = "compare";
	}

	const remainingArgs = [...args];
	while (remainingArgs.length > 0) {
		const arg = remainingArgs.shift();
		switch (arg) {
			case "--category":
				category = remainingArgs.shift();
				break;
			case "--case":
				caseId = remainingArgs.shift();
				break;
			case "--model":
				model = remainingArgs.shift();
				break;
			case "--file":
				file = remainingArgs.shift();
				break;
			case "--no-save":
				noSave = true;
				break;
			case "--skip-judge":
				skipJudge = true;
				break;
			case "--rejudge":
				rejudge = true;
				break;
			case "--diff":
				diff = true;
				break;
			case "--api-url":
				apiUrl = remainingArgs.shift() ?? apiUrl;
				break;
			case "--concurrency":
				concurrency = Number.parseInt(remainingArgs.shift() ?? "", 10) || 10;
				break;
			default:
				break;
		}
	}

	return {
		subcommand,
		category,
		caseId,
		model,
		file,
		noSave,
		skipJudge,
		rejudge,
		diff,
		apiUrl,
		concurrency,
	};
}

interface SlotState {
	caseId: string;
	startedAt: number;
	status: "running" | "done";
	steps: number;
	textChars: number;
	tools: string[];
}

function formatElapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

function renderLiveSlots(
	slots: Map<number, SlotState>,
	completed: number,
	total: number,
	startTime: number
) {
	const lines: string[] = [];
	const elapsed = formatElapsed(Date.now() - startTime);
	lines.push(`${DIM}[${elapsed}] ${completed}/${total} done${RESET}`);

	for (const [, slot] of slots) {
		if (slot.status !== "running") {
			continue;
		}
		const age = formatElapsed(Date.now() - slot.startedAt);
		const toolStr =
			slot.tools.length > 0 ? ` ${CYAN}${slot.tools.at(-1)}${RESET}` : "";
		const charStr =
			slot.textChars > 0 ? ` ${DIM}${slot.textChars}ch${RESET}` : "";
		lines.push(
			`  ${YELLOW}▶${RESET} ${slot.caseId.slice(0, 30).padEnd(30)} step ${slot.steps}${toolStr}${charStr} ${DIM}${age}${RESET}`
		);
	}

	const output = lines.join("\n");
	const lineCount = lines.length;

	process.stderr.write(`${output}\n`);

	return lineCount;
}

function clearLines(count: number) {
	for (let i = 0; i < count; i++) {
		process.stderr.write(`\x1b[A${CLEAR_LINE}`);
	}
}

async function runSingleCase(
	evalCase: EvalCase,
	config: EvalConfig,
	onProgress?: (evt: ProgressEvent) => void
): Promise<CaseResult> {
	try {
		const response = await runCase(evalCase, config, onProgress);
		const { scores, failures, warnings } = scoreCase(evalCase, response);

		const result: CaseResult = {
			id: evalCase.id,
			category: evalCase.category,
			name: evalCase.name,
			query: evalCase.query,
			passed: false,
			scores,
			metrics: {
				steps: response.steps,
				latencyMs: response.latencyMs,
				inputTokens: response.inputTokens,
				outputTokens: response.outputTokens,
				costUsd: 0,
			},
			toolsCalled: [...new Set(response.toolCalls.map((tc) => tc.name))],
			toolCalls: response.toolCalls,
			failures: [...failures, ...warnings],
			warnings,
			response: response.textContent,
		};
		refreshCaseStatus(result, evalCase);
		return result;
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Unknown error";
		return {
			id: evalCase.id,
			category: evalCase.category,
			name: evalCase.name,
			query: evalCase.query,
			passed: false,
			scores: {},
			metrics: {
				steps: 0,
				latencyMs: 0,
				inputTokens: 0,
				outputTokens: 0,
				costUsd: 0,
			},
			toolsCalled: [],
			toolCalls: [],
			failures: [`Runner error: ${msg}`],
			warnings: [],
			response: "",
		};
	}
}

function buildRun(
	results: CaseResult[],
	model: string,
	apiUrl: string,
	duration: number,
	judgeModel?: string
): EvalRun {
	const dimSums: ScoreCard = {
		tool_routing: 0,
		behavioral: 0,
		quality: 0,
		format: 0,
		performance: 0,
	};
	const dimCounts: ScoreCard = {
		tool_routing: 0,
		behavioral: 0,
		quality: 0,
		format: 0,
		performance: 0,
	};
	for (const r of results) {
		for (const [k, v] of Object.entries(r.scores)) {
			if (v !== undefined && v >= 0) {
				dimSums[k as keyof ScoreCard] += v;
				dimCounts[k as keyof ScoreCard] += 1;
			}
		}
	}

	const dimensions: ScoreCard = {
		tool_routing: dimCounts.tool_routing
			? Math.round(dimSums.tool_routing / dimCounts.tool_routing)
			: 0,
		behavioral: dimCounts.behavioral
			? Math.round(dimSums.behavioral / dimCounts.behavioral)
			: 0,
		quality: dimCounts.quality
			? Math.round(dimSums.quality / dimCounts.quality)
			: 0,
		format: dimCounts.format
			? Math.round(dimSums.format / dimCounts.format)
			: 0,
		performance: dimCounts.performance
			? Math.round(dimSums.performance / dimCounts.performance)
			: 0,
	};

	const passedCount = results.filter((r) => r.passed).length;
	const overallScore = Math.round(
		Object.values(dimensions).reduce((a, b) => a + b, 0) / 5
	);

	return {
		timestamp: new Date().toISOString(),
		model,
		apiUrl,
		duration,
		judgeModel,
		summary: {
			total: results.length,
			passed: passedCount,
			failed: results.length - passedCount,
			score: overallScore,
		},
		dimensions,
		cases: results,
	};
}

function saveRun(run: EvalRun, resultsDir: string): string {
	mkdirSync(resultsDir, { recursive: true });
	const slug = run.model.replace(/\//g, "--");
	const ts = new Date()
		.toISOString()
		.replace(/[:.]/g, "")
		.replace("T", "-")
		.slice(0, 15);
	const filename = `${ts}_${slug}.json`;
	const filepath = join(resultsDir, filename);
	writeFileSync(filepath, JSON.stringify(run, null, 2));
	return filepath;
}

async function cmdRun() {
	const opts = parseArgs();
	const modelId = opts.model ?? "anthropic/claude-sonnet-4.6";
	const judgeModel = process.env.EVAL_JUDGE_MODEL ?? "zai/glm-5-turbo";

	const config: EvalConfig = {
		apiUrl: opts.apiUrl,
		authCookie: process.env.EVAL_SESSION_COOKIE,
		apiKey: process.env.EVAL_API_KEY,
		judgeModel,
		modelOverride: opts.model,
	};

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
			console.error(`No cases for category '${opts.category}'`);
			process.exit(1);
		}
	}

	if (opts.rejudge) {
		await rejudgeFromFile(opts, judgeModel);
		return;
	}

	const concurrency = Math.min(opts.concurrency, cases.length);
	console.log(
		`${BOLD}Running ${cases.length} evals${RESET} against ${config.apiUrl} (concurrency: ${concurrency})`
	);
	console.log(`Model: ${modelId}`);
	if (!opts.skipJudge) {
		console.log(`Judge: ${judgeModel}`);
	}
	console.log("");

	const runStart = Date.now();
	let completed = 0;
	const pendingJudges: Promise<void>[] = [];

	const slots = new Map<number, SlotState>();
	let lastLineCount = 0;
	let slotIdCounter = 0;
	const isTTY = process.stderr.isTTY;

	function redraw() {
		if (!isTTY) {
			return;
		}
		if (lastLineCount > 0) {
			clearLines(lastLineCount);
		}
		lastLineCount = renderLiveSlots(slots, completed, cases.length, runStart);
	}

	let redrawTimer: ReturnType<typeof setInterval> | null = null;
	if (isTTY) {
		process.stderr.write(HIDE_CURSOR);
		redrawTimer = setInterval(redraw, 500);
	}

	const results: CaseResult[] = new Array(cases.length);
	let nextIdx = 0;

	async function worker() {
		while (nextIdx < cases.length) {
			const idx = nextIdx++;
			const evalCase = cases[idx];
			const slotId = slotIdCounter++;

			const slot: SlotState = {
				caseId: evalCase.id,
				startedAt: Date.now(),
				steps: 0,
				tools: [],
				textChars: 0,
				status: "running",
			};
			slots.set(slotId, slot);
			redraw();

			const result = await runSingleCase(evalCase, config, (evt) => {
				switch (evt.kind) {
					case "step":
						slot.steps = evt.step;
						break;
					case "tool":
						slot.tools.push(evt.name);
						break;
					case "text":
						slot.textChars = evt.chars;
						break;
				}
			});

			results[idx] = result;
			slot.status = "done";
			slots.delete(slotId);
			completed++;

			if (isTTY && lastLineCount > 0) {
				clearLines(lastLineCount);
				lastLineCount = 0;
			}

			const status = result.failures[0]?.startsWith("Runner error")
				? `${RED}ERROR${RESET}`
				: result.passed
					? result.warnings.length > 0
						? `${YELLOW}WARN${RESET} (${result.warnings.length})`
						: `${GREEN}OK${RESET}`
					: `${RED}FAIL${RESET} (${result.failures.length})`;
			const time = formatElapsed(result.metrics.latencyMs);
			const toolList =
				slot.tools.length > 0
					? ` ${DIM}[${[...new Set(slot.tools)].join(", ")}]${RESET}`
					: "";
			console.log(
				`  ${String(completed).padStart(2)}/${cases.length} ${evalCase.id.slice(0, 30).padEnd(30)} ${status} ${time} ${DIM}${slot.steps} steps${RESET}${toolList}`
			);

			if (result.failures.length > 0) {
				for (const f of result.failures) {
					console.log(`       ${DIM}-> ${f}${RESET}`);
				}
			}
			if (result.warnings.length > 0) {
				for (const w of result.warnings) {
					console.log(`       ${DIM}~  ${w}${RESET}`);
				}
			}

			redraw();

			if (
				!opts.skipJudge &&
				shouldJudgeCase(evalCase) &&
				result.response.length > 0
			) {
				pendingJudges.push(
					judgeQuality(evalCase, result.response, result.toolCalls, judgeModel)
						.then((scores) => {
							if (scores) {
								result.scores.quality = scores.average;
								result.qualityDetail = scores;
								refreshCaseStatus(result, evalCase);

								if (isTTY && lastLineCount > 0) {
									clearLines(lastLineCount);
									lastLineCount = 0;
								}
								console.log(
									`  ${DIM}[judge]${RESET} ${evalCase.id.slice(0, 25)} q=${scores.average} ${result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`} ${DIM}dg=${scores.dataGrounding} ad=${scores.analyticalDepth} ac=${scores.actionability} co=${scores.completeness} cm=${scores.communication}${RESET}`
								);
								if (scores.explanation) {
									console.log(`         ${DIM}${scores.explanation}${RESET}`);
								}
								redraw();
							}
						})
						.catch((err) => {
							if (isTTY && lastLineCount > 0) {
								clearLines(lastLineCount);
								lastLineCount = 0;
							}
							console.log(
								`  ${DIM}[judge]${RESET} ${evalCase.id.slice(0, 25)} ${RED}error${RESET}: ${err instanceof Error ? err.message : err}`
							);
							redraw();
						})
				);
			}
		}
	}

	const workers = Array.from({ length: concurrency }, () => worker());
	await Promise.all(workers);

	if (redrawTimer) {
		clearInterval(redrawTimer);
	}
	if (isTTY) {
		if (lastLineCount > 0) {
			clearLines(lastLineCount);
		}
		process.stderr.write(SHOW_CURSOR);
	}

	if (pendingJudges.length > 0) {
		console.log(
			`\n${DIM}Awaiting ${pendingJudges.length} judge calls...${RESET}`
		);
		await Promise.all(pendingJudges);
	}

	const run = buildRun(
		results,
		modelId,
		config.apiUrl,
		Date.now() - runStart,
		opts.skipJudge ? undefined : judgeModel
	);
	printReport(run);

	if (!opts.noSave) {
		const resultsDir = join(import.meta.dir, "..", "results");
		const filepath = saveRun(run, resultsDir);
		console.log(`Saved: ${filepath}`);
	}

	if (run.summary.failed > 0) {
		process.exitCode = 1;
	}
}

async function rejudgeFromFile(opts: CliOpts, judgeModel: string) {
	const resultsDir = join(import.meta.dir, "..", "results");
	let filepath: string;

	if (opts.file) {
		filepath = opts.file;
	} else if (opts.model) {
		const slug = opts.model.replace(/\//g, "--");
		const all = readdirSync(resultsDir)
			.filter((f) => f.endsWith(".json") && f.includes(slug))
			.sort();
		if (all.length === 0) {
			console.error(`No results found for model ${opts.model}`);
			process.exit(1);
		}
		const latest = all.at(-1)!;
		filepath = join(resultsDir, latest);
	} else {
		console.error("--rejudge requires --model or --file");
		process.exit(1);
	}

	const run: EvalRun = JSON.parse(readFileSync(filepath, "utf-8"));
	console.log(`Re-judging ${run.model} (${filepath})...`);
	console.log(`Judge: ${judgeModel}\n`);

	const toJudge = run.cases.filter((c) => {
		const evalCase = getCaseById(c.id);
		return !!(evalCase && shouldJudgeCase(evalCase) && c.response?.length > 0);
	});

	if (toJudge.length === 0) {
		console.log("No quality cases to judge");
		return;
	}

	const results = await Promise.all(
		toJudge.map(async (caseResult) => {
			const evalCase = getCaseById(caseResult.id);
			if (!evalCase) {
				return false;
			}

			const scores = await judgeQuality(
				evalCase,
				caseResult.response,
				caseResult.toolCalls,
				judgeModel
			);
			if (!scores) {
				console.log(`  ${caseResult.id}: judge failed`);
				return false;
			}

			caseResult.scores.quality = scores.average;
			caseResult.qualityDetail = scores;
			refreshCaseStatus(caseResult, evalCase);
			console.log(
				`  ${caseResult.id}: quality=${scores.average} ${caseResult.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`} (dg=${scores.dataGrounding} ad=${scores.analyticalDepth} ac=${scores.actionability} co=${scores.completeness} cm=${scores.communication})`
			);
			if (scores.explanation) {
				console.log(`    ${DIM}${scores.explanation}${RESET}`);
			}
			return true;
		})
	);

	const judged = results.filter(Boolean).length;
	if (judged > 0) {
		const updated = buildRun(
			run.cases,
			run.model,
			run.apiUrl,
			run.duration,
			judgeModel
		);
		updated.timestamp = run.timestamp;
		writeFileSync(filepath, JSON.stringify(updated, null, 2));
		console.log(`\nUpdated ${filepath} (${judged} cases re-judged)`);
		printReport(updated);
	}
}

function cmdCompare() {
	const opts = parseArgs();
	const resultsDir = join(import.meta.dir, "..", "results");
	const all = readdirSync(resultsDir)
		.filter((f) => f.endsWith(".json"))
		.sort();

	const latestByModel = new Map<string, EvalRun>();
	for (const f of all) {
		const run: EvalRun = JSON.parse(readFileSync(join(resultsDir, f), "utf-8"));
		if (run.summary.total === 0) {
			continue;
		}
		latestByModel.set(run.model, run);
	}

	const models = [...latestByModel.keys()].sort();
	const firstRun = latestByModel.values().next().value;
	if (!firstRun) {
		console.log("No results to compare");
		return;
	}
	const caseIds = firstRun.cases.map((c: CaseResult) => c.id);

	const COL = 20;
	const pad = (s: string, n: number) =>
		s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);

	const shortName = (m: string) => {
		const parts = m.split("/");
		return (parts.at(-1) ?? m).slice(0, COL - 1);
	};

	console.log(
		`\n${"Case".padEnd(32)} | ${models.map((m) => pad(shortName(m), COL)).join(" | ")}`
	);
	console.log("-".repeat(34 + models.length * (COL + 3)));

	for (const cid of caseIds) {
		let row = `${pad(cid.slice(0, 30), 32)} |`;
		const cellValues: string[] = [];

		for (const model of models) {
			const run = latestByModel.get(model);
			if (!run) {
				cellValues.push(pad("--", COL));
				continue;
			}
			const c = run.cases.find((x) => x.id === cid);
			if (!c) {
				cellValues.push(pad("--", COL));
				continue;
			}
			const status = c.passed ? "OK" : "FAIL";
			const t = `${(c.metrics.latencyMs / 1000).toFixed(0)}s`;
			const q =
				c.scores.quality !== undefined && c.scores.quality > 0
					? `q${c.scores.quality}`
					: "";
			cellValues.push(pad(`${status} ${t} ${q}`.trim(), COL));
		}

		if (opts.diff) {
			const statuses = cellValues.map((v) => v.trim().startsWith("OK"));
			const hasDiff = statuses.some((s) => s !== statuses[0]);
			if (!hasDiff) {
				continue;
			}
		}

		for (const v of cellValues) {
			row += ` ${v} |`;
		}
		console.log(row);
	}

	console.log("-".repeat(34 + models.length * (COL + 3)));
	let summaryRow = `${pad("TOTAL", 32)} |`;
	for (const model of models) {
		const run = latestByModel.get(model);
		if (!run) {
			summaryRow += ` ${pad("--", COL)} |`;
			continue;
		}
		const s = run.summary;
		const d = run.dimensions;
		const avgLat =
			run.cases
				.filter((c) => c.passed)
				.reduce((a, c) => a + c.metrics.latencyMs, 0) /
			(s.passed || 1) /
			1000;
		const q = d.quality > 0 ? ` q${d.quality}` : "";
		summaryRow += ` ${pad(`${s.passed}/${s.total} ${avgLat.toFixed(0)}s${q}`, COL)} |`;
	}
	console.log(summaryRow);
	console.log("");
}

async function main() {
	const opts = parseArgs();
	switch (opts.subcommand) {
		case "compare":
			cmdCompare();
			break;
		default:
			await cmdRun();
			break;
	}
}

main().catch((err) => {
	console.error("Eval failed:", err);
	process.exit(1);
});
