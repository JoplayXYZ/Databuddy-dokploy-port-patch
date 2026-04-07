import type { BaseTracker } from "../core/tracker";

const PIXEL_PATH = "/px.jpg";

function safeStringify(value: unknown): string {
	const seen = new WeakSet();
	return JSON.stringify(value, (_key, val) => {
		if (typeof val === "object" && val !== null) {
			if (seen.has(val)) {
				return "[Circular]";
			}
			seen.add(val);
		}
		return val;
	});
}

/**
 * Map a tracker endpoint to the `type` query param that basket's
 * /px.jpg handler dispatches on. basket only supports `track` and
 * `outgoing_link` events via pixel transport (see
 * apps/basket/src/utils/pixel.ts → parsePixelQuery and
 * apps/basket/src/routes/basket.ts → GET /px.jpg).
 *
 * Other endpoints (/vitals, /errors) have no pixel equivalent and we
 * skip them rather than sending GET image loads to paths basket only
 * serves as POST. The tracker tests' strict basket route allowlist
 * (packages/tracker/tests/test-utils.ts) catches any drift here.
 */
function pixelEventTypeFor(endpoint: string): string | null {
	if (endpoint === "/" || endpoint === "/batch" || endpoint === "/track") {
		return "track";
	}
	if (endpoint === "/outgoing") {
		return "outgoing_link";
	}
	return null;
}

export function initPixelTracking(tracker: BaseTracker) {
	tracker.options.enableBatching = false;

	const sendOnePixel = (
		eventType: string,
		data: Record<string, unknown>
	): Promise<{ success: boolean }> => {
		const params = new URLSearchParams();

		const flatten = (obj: Record<string, unknown>, prefix = "") => {
			for (const key in obj) {
				if (Object.hasOwn(obj, key)) {
					const value = obj[key];
					const newKey = prefix ? `${prefix}[${key}]` : key;

					if (value === null || value === undefined) {
						continue;
					}

					if (typeof value === "object" && value !== null) {
						if (prefix === "" && key === "properties") {
							params.append(key, safeStringify(value));
						} else {
							params.append(newKey, safeStringify(value));
						}
					} else {
						params.append(newKey, String(value));
					}
				}
			}
		};

		flatten(data);

		if (!params.has("type")) {
			params.set("type", eventType);
		}
		if (tracker.options.clientId && !params.has("client_id")) {
			params.set("client_id", tracker.options.clientId);
		}
		if (!params.has("sdk_name")) {
			params.set("sdk_name", tracker.options.sdk || "web");
		}
		if (!params.has("sdk_version")) {
			params.set("sdk_version", tracker.options.sdkVersion || "2.0.0");
		}

		const baseUrl = tracker.options.apiUrl || "https://basket.databuddy.cc";
		const url = new URL(PIXEL_PATH, baseUrl);
		params.forEach((value, key) => {
			url.searchParams.append(key, value);
		});

		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ success: true });
			img.onerror = () => resolve({ success: false });
			img.src = url.toString();
		});
	};

	const sendToPixel = async (
		endpoint: string,
		data: unknown
	): Promise<{ success: boolean }> => {
		const eventType = pixelEventTypeFor(endpoint);
		if (!eventType) {
			return { success: false };
		}

		// Batched arrays: fire one pixel per event since /px.jpg only
		// accepts a single event per GET. The tracker batches screen
		// views and custom track events into arrays sent to /batch.
		if (Array.isArray(data)) {
			if (data.length === 0) {
				return { success: true };
			}
			const results = await Promise.all(
				data.map((event) =>
					event && typeof event === "object"
						? sendOnePixel(eventType, event as Record<string, unknown>)
						: Promise.resolve({ success: false })
				)
			);
			return { success: results.every((r) => r.success) };
		}

		if (typeof data !== "object" || data === null) {
			return { success: false };
		}
		return sendOnePixel(eventType, data as Record<string, unknown>);
	};

	tracker.api.fetch = <T>(endpoint: string, data: unknown): Promise<T | null> =>
		sendToPixel(endpoint, data) as Promise<T | null>;

	tracker.sendBeacon = (data: unknown, endpoint = "/") => {
		sendToPixel(endpoint, data);
		return true;
	};

	tracker.sendBatchBeacon = () => false;
}
