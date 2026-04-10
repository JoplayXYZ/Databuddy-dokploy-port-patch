import { beforeEach, describe, expect, mock, test } from "bun:test";

// ── Mocks (must come before route imports) ──

const noop = mock(() => {});
const noopAsync = mock(() => Promise.resolve());
const mockLogger = {
	set: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	info: mock(() => {}),
};

mock.module("evlog/elysia", () => ({
	useLogger: () => mockLogger,
}));

mock.module("@lib/tracing", () => ({
	record: (_n: string, fn: Function) => Promise.resolve().then(() => fn()),
	captureError: noop,
}));

const mockValidateRequest = mock(() =>
	Promise.resolve({
		clientId: "ws_test",
		userAgent: "TestAgent/1.0",
		ip: "1.2.3.4",
		ownerId: "user_1",
		organizationId: "org_1",
	})
);
const mockCheckForBot = mock(() => Promise.resolve(undefined));

mock.module("@lib/request-validation", () => ({
	validateRequest: mockValidateRequest,
	checkForBot: mockCheckForBot,
	getWebsiteSecuritySettings: mock(() => null),
	ValidatedRequest: {},
}));

const mockInsertTrackEvent = mock(() => Promise.resolve());
const mockInsertOutgoingLink = mock(() => Promise.resolve());
const mockInsertTrackEventsBatch = mock(() => Promise.resolve());
const mockInsertOutgoingLinksBatch = mock(() => Promise.resolve());
const mockInsertIndividualVitals = mock(() => Promise.resolve());
const mockInsertErrorSpans = mock(() => Promise.resolve());
const mockInsertCustomEvents = mock(() => Promise.resolve());

mock.module("@lib/event-service", () => ({
	buildTrackEvent: mock(() => ({
		id: "built_id",
		client_id: "ws_test",
		event_name: "pageview",
	})),
	insertTrackEvent: mockInsertTrackEvent,
	insertOutgoingLink: mockInsertOutgoingLink,
	insertTrackEventsBatch: mockInsertTrackEventsBatch,
	insertOutgoingLinksBatch: mockInsertOutgoingLinksBatch,
	insertIndividualVitals: mockInsertIndividualVitals,
	insertErrorSpans: mockInsertErrorSpans,
	insertCustomEvents: mockInsertCustomEvents,
}));

mock.module("@lib/security", () => ({
	getDailySalt: mock(() => Promise.resolve("test-salt")),
	saltAnonymousId: mock((id: string) => `salted_${id}`),
	checkDuplicate: mock(() => Promise.resolve(false)),
}));

mock.module("@utils/ip-geo", () => ({
	getGeo: mock(() =>
		Promise.resolve({
			anonymizedIP: "abc123",
			country: "US",
			region: "CA",
			city: "SF",
		})
	),
	extractIpFromRequest: mock(() => "1.2.3.4"),
	closeGeoIPReader: noop,
}));

mock.module("@utils/user-agent", () => ({
	parseUserAgent: mock(() =>
		Promise.resolve({ browserName: "Chrome", osName: "Windows" })
	),
	detectBot: mock(() => ({ isBot: false })),
}));

mock.module("@lib/blocked-traffic", () => ({
	logBlockedTraffic: noop,
}));

mock.module("@lib/billing", () => ({
	checkAutumnUsage: mock(() => Promise.resolve({ allowed: true })),
}));

mock.module("@lib/api-key", () => ({
	getApiKeyFromHeader: mock(() =>
		Promise.resolve({
			id: "key_1",
			organizationId: "org_1",
			userId: "user_1",
			scopes: ["track:events"],
		})
	),
	hasKeyScope: mock(() => true),
	hasGlobalAccess: mock(() => false),
	getAccessibleWebsiteIds: mock(() => ["ws_test"]),
}));

mock.module("@hooks/auth", () => ({
	getWebsiteByIdV2: mock(() =>
		Promise.resolve({
			id: "ws_test",
			domain: "example.com",
			name: "Test",
			status: "ACTIVE",
			ownerId: "user_1",
			organizationId: "org_1",
		})
	),
	resolveApiKeyOwnerId: mock(() => Promise.resolve("user_1")),
	isValidOrigin: mock(() => true),
	isValidOriginFromSettings: mock(() => true),
	isValidIpFromSettings: mock(() => true),
}));

mock.module("@lib/producer", () => ({
	runFork: noop,
	send: mock(() => ({})),
	sendBatch: mock(() => ({})),
	runPromise: noopAsync,
}));

// ── Import routes after mocks ──

const { buildBasketErrorPayload } = await import("@lib/structured-errors");
const { Elysia } = await import("elysia");

// Wrap basket routes with the same onError handler as index.ts
const rawBasket = (await import("./basket")).default;
const basketApp = new Elysia()
	.onError(({ error, code }) => {
		if (code === "NOT_FOUND") {
			return new Response(null, { status: 404 });
		}
		const { status, payload } = buildBasketErrorPayload(error, {
			elysiaCode: code ?? "INTERNAL_SERVER_ERROR",
		});
		return new Response(JSON.stringify(payload), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	})
	.use(rawBasket);

const rawTrack = (await import("./track")).trackRoute;
const trackRoute = new Elysia()
	.onError(({ error, code }) => {
		if (code === "NOT_FOUND") {
			return new Response(null, { status: 404 });
		}
		const { status, payload } = buildBasketErrorPayload(error, {
			elysiaCode: code ?? "INTERNAL_SERVER_ERROR",
		});
		return new Response(JSON.stringify(payload), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	})
	.use(rawTrack);

// ── Helpers ──

const now = Date.now();

function post(
	app: any,
	path: string,
	body: unknown,
	headers?: Record<string, string>
) {
	return app.handle(
		new Request(`http://localhost${path}`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json", ...headers },
		})
	);
}

function get(app: any, path: string) {
	return app.handle(new Request(`http://localhost${path}`));
}

async function json(res: Response) {
	return res.json() as Promise<Record<string, unknown>>;
}

// ── POST / (single ingest) ──

describe("POST /", () => {
	beforeEach(() => {
		mockInsertTrackEvent.mockClear();
		mockInsertOutgoingLink.mockClear();
	});

	test("valid track event → 200", async () => {
		const res = await post(basketApp, "/", {
			type: "track",
			eventId: "evt_1",
			name: "pageview",
			path: "https://example.com/page",
		});
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.type).toBe("track");
	});

	test("valid outgoing_link → 200", async () => {
		const res = await post(basketApp, "/", {
			type: "outgoing_link",
			eventId: "evt_link_1",
			href: "https://external.com",
		});
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.type).toBe("outgoing_link");
	});

	test("unknown event type → 400", async () => {
		const res = await post(basketApp, "/", { type: "bogus" });
		expect(res.status).toBe(400);
	});
});

// ── POST /vitals ──

describe("POST /vitals", () => {
	test("valid vitals batch → 200", async () => {
		const res = await post(basketApp, "/vitals", [
			{
				timestamp: now,
				path: "https://example.com/page",
				metricName: "LCP",
				metricValue: 2500,
			},
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.type).toBe("web_vitals");
		expect(body.count).toBe(1);
	});

	test("invalid vitals (bad metric name) → 400", async () => {
		const res = await post(basketApp, "/vitals", [
			{
				timestamp: now,
				path: "https://example.com",
				metricName: "BOGUS",
				metricValue: 100,
			},
		]);
		expect(res.status).toBe(400);
	});

	test("empty array → 200 with count 0", async () => {
		const res = await post(basketApp, "/vitals", []);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.count).toBe(0);
	});

	test("not an array → 400", async () => {
		const res = await post(basketApp, "/vitals", { not: "array" });
		expect(res.status).toBe(400);
	});
});

// ── POST /errors ──

describe("POST /errors", () => {
	test("valid error batch → 200", async () => {
		const res = await post(basketApp, "/errors", [
			{
				timestamp: now,
				path: "https://example.com/page",
				message: "TypeError: x is undefined",
			},
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.type).toBe("error");
		expect(body.count).toBe(1);
	});

	test("missing message → 400", async () => {
		const res = await post(basketApp, "/errors", [
			{ timestamp: now, path: "https://example.com" },
		]);
		expect(res.status).toBe(400);
	});
});

// ── POST /events (custom events) ──

describe("POST /events", () => {
	test("valid custom event → 200", async () => {
		const res = await post(basketApp, "/events", [
			{
				timestamp: now,
				path: "https://example.com/page",
				eventName: "purchase",
			},
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.type).toBe("custom_event");
	});

	test("empty eventName → 400", async () => {
		const res = await post(basketApp, "/events", [
			{ timestamp: now, path: "https://example.com", eventName: "" },
		]);
		expect(res.status).toBe(400);
	});

	test("missing organizationId → 400", async () => {
		mockValidateRequest.mockResolvedValueOnce({
			clientId: "ws_test",
			userAgent: "TestAgent/1.0",
			ip: "1.2.3.4",
			ownerId: "user_1",
			organizationId: undefined,
		} as any);
		const res = await post(basketApp, "/events", [
			{ timestamp: now, path: "https://example.com/page", eventName: "x" },
		]);
		expect(res.status).toBe(400);
	});
});

// ── POST /batch ──

describe("POST /batch", () => {
	test("batch of track events → 200", async () => {
		const res = await post(basketApp, "/batch", [
			{
				type: "track",
				eventId: "evt_1",
				name: "pageview",
				path: "https://example.com/a",
			},
			{
				type: "track",
				eventId: "evt_2",
				name: "click",
				path: "https://example.com/b",
			},
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.batch).toBe(true);
		expect(body.processed).toBe(2);
	});

	test("not an array → 400", async () => {
		const res = await post(basketApp, "/batch", { not: "array" });
		expect(res.status).toBe(400);
	});

	test("too many events (101) → 400", async () => {
		const events = Array.from({ length: 101 }, (_, i) => ({
			type: "track",
			eventId: `evt_${i}`,
			name: "x",
			path: "https://example.com",
		}));
		const res = await post(basketApp, "/batch", events);
		expect(res.status).toBe(400);
	});

	test("mixed valid + unknown types → partial results", async () => {
		const res = await post(basketApp, "/batch", [
			{
				type: "track",
				eventId: "evt_1",
				name: "pageview",
				path: "https://example.com/a",
			},
			{ type: "bogus_type" },
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.processed).toBe(2);
		const results = body.results as any[];
		expect(results[1].status).toBe("error");
		expect(results[1].message).toBe("Unknown event type");
	});
});

// ── GET /px.jpg ──

describe("GET /px.jpg", () => {
	test("returns transparent GIF", async () => {
		const res = await get(basketApp, "/px.jpg?type=track&name=pageview");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("image/gif");
	});

	test("always returns pixel even on error", async () => {
		mockValidateRequest.mockRejectedValueOnce(new Error("boom"));
		const res = await get(basketApp, "/px.jpg?name=test");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("image/gif");
	});
});

// ── POST /track (API key custom events) ──

describe("POST /track", () => {
	test("single event → 200", async () => {
		const res = await post(trackRoute, "/track", {
			name: "signup",
			websiteId: "ws_test",
		});
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.type).toBe("custom_event");
		expect(body.count).toBe(1);
	});

	test("batch of events → 200", async () => {
		const res = await post(trackRoute, "/track", [
			{ name: "signup", websiteId: "ws_test" },
			{ name: "purchase", websiteId: "ws_test", properties: { plan: "pro" } },
		]);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.count).toBe(2);
	});

	test("missing name → 400", async () => {
		const res = await post(trackRoute, "/track", {
			namespace: "x",
			websiteId: "ws_test",
		});
		expect(res.status).toBe(400);
	});

	test("empty name → 400", async () => {
		const res = await post(trackRoute, "/track", {
			name: "",
			websiteId: "ws_test",
		});
		expect(res.status).toBe(400);
	});

	test("inserts call event-service", async () => {
		mockInsertCustomEvents.mockClear();
		await post(trackRoute, "/track", {
			name: "test_event",
			websiteId: "ws_test",
		});
		expect(mockInsertCustomEvents).toHaveBeenCalled();
	});
});

// ── GET /health (inline in index.ts, test directly) ──

import { Elysia as ElysiaHealth } from "elysia";

describe("GET /health", () => {
	const healthApp = new ElysiaHealth().get("/health", () =>
		Response.json({ status: "ok" }, { status: 200 })
	);

	test("returns 200 with status ok", async () => {
		const res = await healthApp.handle(new Request("http://localhost/health"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.status).toBe("ok");
	});
});

// ═══════════════════════════════════════════════════════════
// Response contract tests — exact shapes consumers depend on
// ═══════════════════════════════════════════════════════════

describe("response contracts", () => {
	// ── Success responses ──

	test("POST / track → { status, type }", async () => {
		const res = await post(basketApp, "/", {
			type: "track",
			eventId: "evt_c1",
			name: "pageview",
			path: "https://example.com/page",
		});
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "track" });
	});

	test("POST / outgoing_link → { status, type }", async () => {
		const res = await post(basketApp, "/", {
			type: "outgoing_link",
			eventId: "evt_c2",
			href: "https://external.com",
		});
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "outgoing_link" });
	});

	test("POST /vitals → { status, type, count }", async () => {
		const res = await post(basketApp, "/vitals", [
			{
				timestamp: now,
				path: "https://example.com",
				metricName: "LCP",
				metricValue: 2500,
			},
			{
				timestamp: now,
				path: "https://example.com",
				metricName: "FCP",
				metricValue: 1200,
			},
		]);
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "web_vitals", count: 2 });
	});

	test("POST /errors → { status, type, count }", async () => {
		const res = await post(basketApp, "/errors", [
			{ timestamp: now, path: "https://example.com", message: "err" },
		]);
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "error", count: 1 });
	});

	test("POST /events → { status, type, count }", async () => {
		const res = await post(basketApp, "/events", [
			{ timestamp: now, path: "https://example.com", eventName: "purchase" },
		]);
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "custom_event", count: 1 });
	});

	test("POST /track → { status, type, count }", async () => {
		const res = await post(trackRoute, "/track", {
			name: "signup",
			websiteId: "ws_test",
		});
		const body = await json(res);
		expect(body).toEqual({ status: "success", type: "custom_event", count: 1 });
	});

	test("POST /batch → { status, batch, processed, batched, results }", async () => {
		const res = await post(basketApp, "/batch", [
			{ type: "track", eventId: "b1", name: "pv", path: "https://example.com" },
		]);
		const body = await json(res);
		expect(body.status).toBe("success");
		expect(body.batch).toBe(true);
		expect(typeof body.processed).toBe("number");
		expect(body.batched).toEqual(
			expect.objectContaining({
				track: expect.any(Number),
				outgoing_link: expect.any(Number),
			})
		);
		expect(Array.isArray(body.results)).toBe(true);
	});

	// ── Error responses ──

	test("400 error → { success, status, error, message, code, why, fix }", async () => {
		const res = await post(basketApp, "/batch", { not: "array" });
		expect(res.status).toBe(400);
		const body = await json(res);
		expect(body.success).toBe(false);
		expect(body.status).toBe("error");
		expect(typeof body.error).toBe("string");
		expect(typeof body.message).toBe("string");
		expect(typeof body.code).toBe("string");
		expect(typeof body.why).toBe("string");
		expect(typeof body.fix).toBe("string");
	});

	test("POST / unknown type → 400 structured error", async () => {
		const res = await post(basketApp, "/", { type: "bogus" });
		expect(res.status).toBe(400);
		const body = await json(res);
		expect(body.success).toBe(false);
		expect(typeof body.why).toBe("string");
	});

	test("GET /px.jpg → image/gif regardless of errors", async () => {
		const res = await get(basketApp, "/px.jpg?type=track&name=test");
		expect(res.headers.get("Content-Type")).toBe("image/gif");
		expect(res.headers.get("Cache-Control")).toContain("no-cache");
		const buf = new Uint8Array(await res.arrayBuffer());
		// GIF89a header
		expect(buf[0]).toBe(0x47); // G
		expect(buf[1]).toBe(0x49); // I
		expect(buf[2]).toBe(0x46); // F
	});

	test("GET /health → exactly { status: 'ok' }", async () => {
		const healthApp = new ElysiaHealth().get("/health", () =>
			Response.json({ status: "ok" }, { status: 200 })
		);
		const res = await healthApp.handle(new Request("http://localhost/health"));
		const body = await json(res);
		expect(Object.keys(body)).toEqual(["status"]);
		expect(body.status).toBe("ok");
	});
});
