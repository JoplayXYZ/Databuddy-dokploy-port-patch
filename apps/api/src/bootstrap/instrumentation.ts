import { setAiRequestLoggerProvider } from "@databuddy/ai/lib/request-logger";
import { setChRecordFn } from "@databuddy/db/clickhouse";
import { setPgErrorFn, setPgTraceFn } from "@databuddy/db";
import { setCacheTraceFn } from "@databuddy/redis";
import {
	setRpcRecordFn,
	setRpcRequestLoggerProvider,
	setTrackingFn,
} from "@databuddy/rpc";
import { log } from "evlog";
import { useLogger } from "evlog/elysia";
import { trackMutationEvent } from "@/lib/databuddy";
import { initTccTracing } from "@/lib/tcc-otel";
import { record } from "@/lib/tracing";

const postgresTraceTotals = new WeakMap<
	object,
	[count: number, totalMs: number, maxMs: number]
>();

export function configureApiInstrumentation() {
	setChRecordFn(record);
	setRpcRecordFn(record);
	setTrackingFn(trackMutationEvent);
	setRpcRequestLoggerProvider(useLogger);
	setAiRequestLoggerProvider(useLogger);
	setPgTraceFn(recordPostgresQueryTiming);
	setPgErrorFn(recordPostgresPoolError);
	setCacheTraceFn(enrichRequestWithCacheTrace);
	startTccTracing();
}

function recordPostgresQueryTiming(ms: number) {
	try {
		const logger = useLogger();
		const previous = postgresTraceTotals.get(logger) ?? [0, 0, 0];
		const next: [number, number, number] = [
			previous[0] + 1,
			previous[1] + ms,
			Math.max(previous[2], ms),
		];
		postgresTraceTotals.set(logger, next);
		logger.set({
			"pg.query_count": next[0],
			"pg.total_ms": Math.round(next[1] * 100) / 100,
			"pg.max_ms": next[2],
		});
	} catch {}
}

function recordPostgresPoolError(error: Error) {
	log.error({
		service: "api",
		component: "postgres_pool",
		error_message: error.message,
		error_stack: error.stack,
	});
}

function enrichRequestWithCacheTrace(fields: Record<string, unknown>) {
	try {
		useLogger().set(fields);
	} catch {}
}

function startTccTracing() {
	try {
		initTccTracing();
	} catch (error) {
		log.warn({
			service: "api",
			component: "tcc_otel",
			message: "TCC tracing disabled (init failed)",
			error_message: error instanceof Error ? error.message : String(error),
		});
	}
}
