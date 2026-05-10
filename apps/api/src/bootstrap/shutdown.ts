import { shutdownPostgres, warmPool } from "@databuddy/db";
import { log } from "evlog";
import { flushBatchedApiDrain } from "@/lib/evlog-api";
import { shutdownTccTracing } from "@/lib/tcc-otel";

export function warmPostgresPool() {
	warmPool().catch((error) =>
		log.error({
			lifecycle: "poolWarm",
			error_message: error instanceof Error ? error.message : String(error),
		})
	);
}

export function registerShutdownHooks() {
	process.on("SIGINT", () => shutdownApi("SIGINT"));
	process.on("SIGTERM", () => shutdownApi("SIGTERM"));
}

async function shutdownApi(signal: string) {
	log.info("lifecycle", `${signal} received, shutting down gracefully`);
	const { shutdownRedis } = await import("@databuddy/redis");
	await Promise.all([
		shutdownRedis().catch((error) =>
			log.error({
				lifecycle: "redisShutdown",
				error_message: error instanceof Error ? error.message : String(error),
			})
		),
		shutdownPostgres().catch((error) =>
			log.error({
				lifecycle: "postgresShutdown",
				error_message: error instanceof Error ? error.message : String(error),
			})
		),
		flushBatchedApiDrain().catch((error) =>
			log.error({
				lifecycle: "drainFlush",
				error_message: error instanceof Error ? error.message : String(error),
			})
		),
		shutdownTccTracing().catch((error) =>
			log.error({
				lifecycle: "tccOtelShutdown",
				error_message: error instanceof Error ? error.message : String(error),
			})
		),
	]);
	process.exit(0);
}
