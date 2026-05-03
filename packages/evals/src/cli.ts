import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allCases, getCaseById, getCasesByCategory } from "./cases";
import { judgeQuality } from "./judge";
import { printReport } from "./report";
import { runCase } from "./runner";
import { scoreCase } from "./scorers";
import type {
	CaseResult,
	EvalCase,
	EvalConfig,
	EvalRun,
	ScoreCard,
} from "./types";

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

async function runSingleCase(
	evalCase: EvalCase,
	config: EvalConfig
): Promise<CaseResult> {
	try {
		const response = await runCase(evalCase, config);
		const { scores, failures, warnings } = scoreCase(evalCase, response);

		const scoreValues = Object.values(scores).filter(
			(v): v is number => v !== undefined
		);
		const avgScore =
			scoreValues.length > 0
				? Math.round(
						scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
					)
				: 0;
		const passed = failures.length === 0 && avgScore >= 60;

		return {
			id: evalCase.id,
			category: evalCase.category,
			name: evalCase.name,
			query: evalCase.query,
			passed,
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
			response: response.textContent,
		};
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
			response: "",
		};
	}
}

async function runWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<R>,
	onComplete?: (item: T, result: R) => void
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIdx = 0;

	async function worker() {
		while (nextIdx < items.length) {
			const idx = nextIdx++;
			const item = items[idx];
			const result = await fn(item);
			results[idx] = result;
			onComplete?.(item, result);
		}
	}

	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		() => worker()
	);
	await Promise.all(workers);
	return results;
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

	const c = Math.min(opts.concurrency, cases.length);
	console.log(
		`Running ${cases.length} eval cases against ${config.apiUrl} (concurrency: ${c})...`
	);
	console.log(`Model: ${modelId}`);
	if (!opts.skipJudge) {
		console.log(`Judge: ${judgeModel}`);
	}
	console.log("");

	const runStart = Date.now();
	let completed = 0;
	const pendingJudges: Promise<void>[] = [];

	const results = await runWithConcurrency(
		cases,
		c,
		(evalCase) => runSingleCase(evalCase, config),
		(evalCase, result) => {
			completed++;
			const status = result.passed
				? "\x1b[32mOK\x1b[0m"
				: result.failures[0]?.startsWith("Runner error")
					? "\x1b[31mERROR\x1b[0m"
					: `\x1b[31mFAIL\x1b[0m (${result.failures.length})`;
			const time = `${(result.metrics.latencyMs / 1000).toFixed(1)}s`;
			console.log(
				`  [${completed}/${cases.length}] ${evalCase.id} ${status} ${time}`
			);

			if (
				!opts.skipJudge &&
				evalCase.category === "quality" &&
				result.response.length > 0
			) {
				pendingJudges.push(
					judgeQuality(evalCase, result.response, result.toolCalls, judgeModel)
						.then((scores) => {
							if (scores) {
								result.scores.quality = scores.average;
								result.qualityDetail = scores;
								console.log(
									`  [judge] ${evalCase.id}: q=${scores.average} (dg=${scores.dataGrounding} ad=${scores.analyticalDepth} ac=${scores.actionability} co=${scores.completeness} cm=${scores.communication})`
								);
							}
						})
						.catch((err) => {
							console.log(
								`  [judge] ${evalCase.id}: ${err instanceof Error ? err.message : err}`
							);
						})
				);
			}
		}
	);

	if (pendingJudges.length > 0) {
		console.log(`\nAwaiting ${pendingJudges.length} judge calls...`);
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
		const latest = all.at(-1);
		if (!latest) {
			console.error(`No results found for model ${opts.model}`);
			process.exit(1);
		}
		filepath = join(resultsDir, latest);
	} else {
		console.error("--rejudge requires --model or --file");
		process.exit(1);
	}

	const run: EvalRun = JSON.parse(readFileSync(filepath, "utf-8"));
	console.log(`Re-judging ${run.model} (${filepath})...`);
	console.log(`Judge: ${judgeModel}\n`);

	const toJudge = run.cases.filter(
		(c) => c.category === "quality" && c.response?.length > 0
	);

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
			console.log(
				`  ${caseResult.id}: quality=${scores.average} (dg=${scores.dataGrounding} ad=${scores.analyticalDepth} ac=${scores.actionability} co=${scores.completeness} cm=${scores.communication})`
			);
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
