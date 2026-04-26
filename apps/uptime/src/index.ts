import { closeUptimeQueue } from "@databuddy/redis";
import { Elysia } from "elysia";
import { initLogger, log } from "evlog";
import { evlog } from "evlog/elysia";
import {
	enrichUptimeWideEvent,
	flushBatchedUptimeDrain,
	uptimeLoggerDrain,
} from "./lib/evlog-uptime";
import { disconnectProducer } from "./lib/producer";
import { captureError } from "./lib/tracing";
import { startUptimeWorker } from "./worker";

initLogger({
	env: { service: "uptime" },
	drain: uptimeLoggerDrain,
	sampling: {},
});

process.on("unhandledRejection", (reason, _promise) => {
	captureError(reason, { process: "unhandledRejection" });
	log.error({
		process: "unhandledRejection",
		reason: reason instanceof Error ? reason.message : String(reason),
	});
});

process.on("uncaughtException", (error) => {
	captureError(error, { process: "uncaughtException" });
	log.error({
		process: "uncaughtException",
		error_message: error instanceof Error ? error.message : String(error),
		error_stack: error instanceof Error ? error.stack : undefined,
		error_source: "process",
	});
});

async function shutdown(signal: string) {
	log.info("lifecycle", `${signal} received, shutting down gracefully`);
	await Promise.allSettled([
		uptimeWorker.close(),
		closeUptimeQueue(),
		flushBatchedUptimeDrain(),
		disconnectProducer(),
	]).catch((error) =>
		log.error({
			lifecycle: "shutdown",
			error_message: error instanceof Error ? error.message : String(error),
		})
	);
	process.exit(0);
}

const uptimeWorker = startUptimeWorker();

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const app = new Elysia()
	.use(
		evlog({
			enrich: enrichUptimeWideEvent,
		})
	)
	.onError(function handleError({ error, code }) {
		captureError(error, {
			error_step: "elysia",
			elysia_code: String(code),
		});
	})
	.get("/health/status", async () => {
		const { db, sql } = await import("@databuddy/db");
		const { getUptimeQueue } = await import("@databuddy/redis");
		const { Kafka } = await import("kafkajs");

		async function ping(probe: () => Promise<void>) {
			const start = performance.now();
			try {
				await probe();
				return {
					status: "ok" as const,
					latency_ms: Math.round(performance.now() - start),
				};
			} catch (err) {
				return {
					status: "error" as const,
					latency_ms: Math.round(performance.now() - start),
					error: err instanceof Error ? err.message : "unknown",
				};
			}
		}

		const [postgres, bullmqRedis, redpanda] = await Promise.all([
			ping(() => db.execute(sql`SELECT 1`).then(() => {})),
			ping(async () => {
				const client = await getUptimeQueue().client;
				await client.ping();
			}),
			ping(async () => {
				const broker = process.env.REDPANDA_BROKER;
				if (!broker) {
					throw new Error("not configured");
				}
				const kafka = new Kafka({
					clientId: "health",
					brokers: [broker],
					connectionTimeout: 5000,
					...(process.env.REDPANDA_USER &&
						process.env.REDPANDA_PASSWORD && {
							sasl: {
								mechanism: "scram-sha-256",
								username: process.env.REDPANDA_USER,
								password: process.env.REDPANDA_PASSWORD,
							},
							ssl: false,
						}),
				});
				const admin = kafka.admin();
				try {
					await admin.connect();
				} finally {
					await admin.disconnect().catch(() => {});
				}
			}),
		]);

		const services = { postgres, bullmqRedis, redpanda };
		const status = Object.values(services).every((s) => s.status === "ok")
			? "ok"
			: "degraded";
		return Response.json(
			{ status, services },
			{ status: status === "ok" ? 200 : 503 }
		);
	})
	.get("/health", () => ({ status: "ok" }));

export default {
	port: 4000,
	fetch: app.fetch,
};
