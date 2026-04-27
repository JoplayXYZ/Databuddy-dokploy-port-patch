import { beforeEach, describe, expect, it } from "bun:test";
import type { ScheduleData } from "./actions";
import type { UptimeData } from "./types";
import {
	processUptimeCheck,
	processUptimeJob,
	type UptimeWorkerDeps,
} from "./worker";

const calls = {
	captureError: [] as Array<{ error: unknown; context: Record<string, unknown> }>,
	check: [] as Array<{
		monitorId: string;
		url: string;
		timeout: number | undefined;
		cacheBust: boolean | undefined;
		extractHealth: boolean | undefined;
	}>,
	email: [] as Array<{ schedule: ScheduleData; data: UptimeData }>,
	merge: [] as Array<Record<string, unknown>>,
	send: [] as Array<{ data: UptimeData; monitorId: string }>,
};

let lookupResult:
	| { success: true; data: ScheduleData }
	| { success: false; error: string };
let checkResult:
	| { success: true; data: UptimeData }
	| { success: false; error: string };
let previousStatus: number | undefined;

function schedule(values: Partial<ScheduleData> = {}): ScheduleData {
	return {
		id: "schedule-1",
		organizationId: "org-1",
		websiteId: "website-1",
		website: { name: "Site", domain: "example.com" },
		url: "https://example.com/health",
		name: "Example",
		isPaused: false,
		timeout: 5000,
		cacheBust: true,
		jsonParsingConfig: { enabled: true },
		...values,
	};
}

function uptimeData(values: Partial<UptimeData> = {}): UptimeData {
	return {
		attempt: 1,
		check_type: "http",
		content_hash: "hash",
		env: "test",
		error: "",
		failure_streak: 0,
		http_code: 200,
		probe_ip: "127.0.0.1",
		probe_region: "local",
		redirect_count: 0,
		response_bytes: 100,
		retries: 0,
		site_id: "website-1",
		ssl_expiry: 0,
		ssl_valid: 1,
		status: 1,
		timestamp: 1_775_000_000,
		total_ms: 30,
		ttfb_ms: 10,
		url: "https://example.com/health",
		user_agent: "test",
		...values,
	};
}

function deps(): UptimeWorkerDeps {
	return {
		captureError: (error, context) => {
			calls.captureError.push({ error, context: context ?? {} });
		},
		checkUptime: async (monitorId, url, _attempt, options) => {
			calls.check.push({
				monitorId,
				url,
				timeout: options.timeout,
				cacheBust: options.cacheBust,
				extractHealth: options.extractHealth,
			});
			return checkResult;
		},
		getPreviousMonitorStatus: async () => previousStatus,
		isHealthExtractionEnabled: (config) =>
			typeof config === "object" &&
			config !== null &&
			"enabled" in config &&
			config.enabled === true,
		lookupSchedule: async () => lookupResult,
		mergeWideEvent: (event) => {
			calls.merge.push(event);
		},
		sendUptimeEvent: async (data, monitorId) => {
			calls.send.push({ data, monitorId });
		},
		sendUptimeTransitionEmailsIfNeeded: async (payload) => {
			calls.email.push(payload);
		},
	};
}

beforeEach(() => {
	calls.captureError = [];
	calls.check = [];
	calls.email = [];
	calls.merge = [];
	calls.send = [];
	lookupResult = { success: true, data: schedule() };
	checkResult = { success: true, data: uptimeData() };
	previousStatus = 0;
});

describe("processUptimeCheck", () => {
	it("rejects unknown BullMQ job names before loading schedules", async () => {
		await expect(
			processUptimeJob(
				{
					name: "surprise",
					data: { scheduleId: "schedule-1", trigger: "scheduled" },
				},
				deps()
			)
		).rejects.toThrow("Unknown uptime job: surprise");

		expect(calls.check).toEqual([]);
	});

	it("routes BullMQ jobs into uptime checks", async () => {
		await processUptimeJob(
			{
				name: "uptime-check",
				data: { scheduleId: "schedule-1", trigger: "manual" },
			},
			deps()
		);

		expect(calls.check).toHaveLength(1);
		expect(calls.merge).toContainEqual(
			expect.objectContaining({ uptime_trigger: "manual" })
		);
	});

	it("runs a scheduled check and emits events, status, and transition email work", async () => {
		await processUptimeCheck("schedule-1", "scheduled", deps());

		expect(calls.check).toEqual([
			{
				monitorId: "website-1",
				url: "https://example.com/health",
				timeout: 5000,
				cacheBust: true,
				extractHealth: true,
			},
		]);
		expect(calls.send).toEqual([
			{ data: uptimeData(), monitorId: "website-1" },
		]);
		expect(calls.email).toHaveLength(1);
		expect(calls.merge).toContainEqual({
			schedule_id: "schedule-1",
			uptime_trigger: "scheduled",
		});
		expect(calls.merge).toContainEqual(
			expect.objectContaining({
				monitor_id: "website-1",
				organization_id: "org-1",
				website_id: "website-1",
			})
		);
		expect(calls.merge).toContainEqual(
			expect.objectContaining({ previous_uptime_status: 0 })
		);
	});

	it("records -1 when no previous monitor status exists", async () => {
		previousStatus = undefined;

		await processUptimeCheck("schedule-1", "scheduled", deps());

		expect(calls.merge).toContainEqual(
			expect.objectContaining({ previous_uptime_status: -1 })
		);
	});

	it("uses the schedule id as monitor id when no website is attached", async () => {
		lookupResult = {
			success: true,
			data: schedule({ website: null, websiteId: null, timeout: null }),
		};

		await processUptimeCheck("schedule-only", "manual", deps());

		expect(calls.check).toEqual([
			{
				monitorId: "schedule-only",
				url: "https://example.com/health",
				timeout: undefined,
				cacheBust: true,
				extractHealth: true,
			},
		]);
		expect(calls.merge).toContainEqual({
			schedule_id: "schedule-only",
			uptime_trigger: "manual",
		});
		expect(calls.merge).toContainEqual(
			expect.objectContaining({
				monitor_id: "schedule-only",
				organization_id: "org-1",
			})
		);
	});

	it("skips paused schedules without running the check", async () => {
		lookupResult = { success: true, data: schedule({ isPaused: true }) };

		await processUptimeCheck("schedule-1", "scheduled", deps());

		expect(calls.check).toEqual([]);
		expect(calls.send).toEqual([]);
		expect(calls.merge).toEqual([
			{
				schedule_id: "schedule-1",
				uptime_trigger: "scheduled",
			},
			{
				organization_id: "org-1",
				uptime_skipped_paused: true,
			},
		]);
	});

	it("skips missing schedules without throwing", async () => {
		lookupResult = { success: false, error: "not found" };

		await processUptimeCheck("schedule-1", "scheduled", deps());

		expect(calls.check).toEqual([]);
		expect(calls.captureError).toHaveLength(1);
		expect(calls.captureError[0]?.context).toMatchObject({
			error_step: "schedule_not_found",
			schedule_id: "schedule-1",
		});
	});

	it("throws failed checks so BullMQ retry/backoff can run", async () => {
		checkResult = { success: false, error: "timeout" };

		await expect(
			processUptimeCheck("schedule-1", "scheduled", deps())
		).rejects.toThrow("timeout");
		expect(calls.captureError[0]?.context).toMatchObject({
			error_step: "uptime_check_failed",
			monitor_id: "website-1",
			check_url: "https://example.com/health",
		});
	});

	it("captures producer pipeline errors without failing the BullMQ job", async () => {
		const failingDeps = deps();
		failingDeps.sendUptimeEvent = async () => {
			throw new Error("producer unavailable");
		};

		await processUptimeCheck("schedule-1", "manual", failingDeps);

		expect(calls.captureError[0]?.context).toMatchObject({
			error_step: "producer_pipeline",
			monitor_id: "website-1",
			http_code: 200,
		});
	});
});
