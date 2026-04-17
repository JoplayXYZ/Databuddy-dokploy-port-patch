/** biome-ignore-all lint/performance/useTopLevelRegex: it's a test file */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UptimeAlertEmail } from "./uptime-alert-email";

type Props = Parameters<typeof UptimeAlertEmail>[0];

function render(props: Props): string {
	return renderToStaticMarkup(UptimeAlertEmail(props));
}

const SAFE_HREF_FALLBACK = "https://app.databuddy.cc/";

describe("UptimeAlertEmail — URL text rendering", () => {
	test("slashes render literally, not as &#x2F; entities", () => {
		const html = render({
			kind: "down",
			siteLabel: "server.example.com",
			url: "https://server.example.com",
		});
		expect(html).toContain("https://server.example.com");
		expect(html).not.toContain("&#x2F;");
		expect(html).not.toContain("&amp;#x2F;");
	});

	test("query-string ampersands are escaped exactly once", () => {
		const html = render({
			kind: "down",
			url: "https://example.com/path?a=1&b=2&c=3",
		});
		expect(html).toContain("a=1&amp;b=2&amp;c=3");
		expect(html).not.toContain("&amp;amp;");
	});

	test("percent-encoded URLs survive unchanged", () => {
		const html = render({
			kind: "down",
			url: "https://example.com/path%20with%20spaces?q=hello%20world",
		});
		expect(html).toContain(
			"https://example.com/path%20with%20spaces?q=hello%20world"
		);
	});

	test("unicode hosts render as typed in text (IDN domains)", () => {
		const html = render({ kind: "down", url: "https://münchen.de/über" });
		expect(html).toContain("münchen.de");
		expect(html).toContain("über");
	});

	test("URLs with port, path, query, fragment all render", () => {
		const html = render({
			kind: "down",
			url: "https://example.com:8443/a/b?x=1#section",
		});
		expect(html).toContain("https://example.com:8443/a/b?x=1#section");
	});

	test("very long URL (2KB) does not throw or truncate visibly", () => {
		const longPath = "a".repeat(2048);
		const url = `https://example.com/${longPath}`;
		const html = render({ kind: "down", url });
		expect(html).toContain(longPath);
	});
});

describe("UptimeAlertEmail — href protocol allowlist (XSS)", () => {
	test("javascript: URL never appears in an href attribute", () => {
		const html = render({ kind: "down", url: "javascript:alert(1)" });
		expect(html).not.toMatch(/href="javascript:/i);
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});

	test("data: URL never appears in an href attribute", () => {
		const html = render({
			kind: "down",
			url: "data:text/html,<script>alert(1)</script>",
		});
		expect(html).not.toMatch(/href="data:/i);
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});

	test("vbscript: URL is rejected", () => {
		const html = render({ kind: "down", url: "vbscript:msgbox(1)" });
		expect(html).not.toMatch(/href="vbscript:/i);
	});

	test("file: URL is rejected", () => {
		const html = render({ kind: "down", url: "file:///etc/passwd" });
		expect(html).not.toMatch(/href="file:/i);
	});

	test("ftp: URL is rejected (non http/https)", () => {
		const html = render({ kind: "down", url: "ftp://example.com/a" });
		expect(html).not.toMatch(/href="ftp:/i);
	});

	test("protocol-relative //evil.com falls back to default href", () => {
		const html = render({ kind: "down", url: "//evil.com/x" });
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});

	test("mixed-case JaVaScRiPt: is rejected (protocol compared case-insensitively by URL parser)", () => {
		const html = render({ kind: "down", url: "JaVaScRiPt:alert(1)" });
		expect(html).not.toMatch(/href="j/i);
	});

	test("URL with embedded whitespace/newline is rejected", () => {
		const html = render({ kind: "down", url: "java\nscript:alert(1)" });
		expect(html).not.toMatch(/href="java/i);
	});

	test("empty url falls back to default href", () => {
		const html = render({ kind: "down", url: "" });
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});

	test("malformed URL (no scheme, unparseable) falls back to default href", () => {
		const html = render({ kind: "down", url: "not a url at all" });
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});
});

describe("UptimeAlertEmail — HTML injection in string fields", () => {
	test("siteLabel <script> is escaped, not executable", () => {
		const html = render({
			kind: "down",
			siteLabel: "<script>alert(1)</script>",
			url: "https://example.com",
		});
		expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	test("siteLabel <img onerror> payload is escaped", () => {
		const html = render({
			kind: "down",
			siteLabel: '<img src=x onerror="alert(1)">',
			url: "https://example.com",
		});
		expect(html).not.toMatch(/<img\s+src=x\s+onerror/i);
		expect(html).toContain("&lt;img");
	});

	test("error field with HTML tags is escaped", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			error: "<svg onload=alert(1)></svg>",
		});
		expect(html).not.toMatch(/<svg\s+onload/i);
		expect(html).toContain("&lt;svg");
	});

	test("probeRegion with injection payload is escaped", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			probeRegion: '"><script>alert(1)</script>',
		});
		expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	test("attribute-breakout quotes in URL payload cannot escape the anchor tag", () => {
		const html = render({
			kind: "down",
			url: 'https://example.com" onmouseover="alert(1)',
		});
		// Raw quote after the anchor tag opens would be a breakout; ensure only escaped.
		expect(html).not.toMatch(/<a[^>]*onmouseover="alert/i);
		expect(html).toContain("onmouseover=&quot;alert(1)");
		// And the href itself must be the safe fallback (URL parser rejects it).
		expect(html).toContain(`href="${SAFE_HREF_FALLBACK}"`);
	});

	test("existing HTML entities in input are escaped only once (no double-encode)", () => {
		const html = render({
			kind: "down",
			siteLabel: "Tom &amp; Jerry",
			url: "https://example.com",
		});
		expect(html).toContain("Tom &amp;amp; Jerry");
		expect(html).not.toContain("Tom &amp;amp;amp;");
	});

	test("null bytes / control chars in siteLabel do not break output", () => {
		const html = render({
			kind: "down",
			siteLabel: "evil\u0000\u0001site",
			url: "https://example.com",
		});
		expect(html.length).toBeGreaterThan(0);
	});
});

describe("UptimeAlertEmail — field fallbacks and optional props", () => {
	test("all optional props undefined renders without throwing", () => {
		const html = render({});
		expect(html.length).toBeGreaterThan(0);
		expect(html).toContain("example.com");
	});

	test("empty siteLabel falls back to 'your site'", () => {
		const html = render({ kind: "down", siteLabel: "", url: "https://x.com" });
		expect(html).toContain("your site");
	});

	test("defaults to kind='down' when kind is missing", () => {
		const html = render({ url: "https://example.com" });
		expect(html).toContain("is down");
		expect(html).not.toContain("back up");
	});

	test("dashboardUrl absent → no dashboard button", () => {
		const html = render({ kind: "down", url: "https://example.com" });
		expect(html).not.toContain("View in Databuddy");
	});

	test("dashboardUrl present → dashboard button appears with that href", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			dashboardUrl: "https://app.databuddy.cc/monitors/abc123",
		});
		expect(html).toContain("View in Databuddy");
		expect(html).toContain("https://app.databuddy.cc/monitors/abc123");
	});
});

describe("UptimeAlertEmail — down vs recovered variants", () => {
	test("down variant uses the down copy and red accent", () => {
		const html = render({
			kind: "down",
			siteLabel: "acme.com",
			url: "https://acme.com",
		});
		expect(html).toContain("acme.com is down");
		expect(html).toContain("could not reach this URL");
		expect(html.toLowerCase()).toContain("#dc2626");
	});

	test("recovered variant uses the recovery copy and green accent", () => {
		const html = render({
			kind: "recovered",
			siteLabel: "acme.com",
			url: "https://acme.com",
		});
		expect(html).toContain("acme.com is back up");
		expect(html).toContain("latest health check succeeded");
		expect(html.toLowerCase()).toContain("#22c55e");
	});

	test("recovered variant omits the error line even if error is passed", () => {
		const html = render({
			kind: "recovered",
			url: "https://acme.com",
			error: "This error should not appear",
		});
		expect(html).not.toContain("This error should not appear");
	});

	test("down variant with empty error hides the error block", () => {
		const html = render({
			kind: "down",
			url: "https://acme.com",
			error: "   \n\t  ",
		});
		expect(html).not.toContain("Error · ");
	});

	test("down variant trims leading/trailing whitespace from error", () => {
		const html = render({
			kind: "down",
			url: "https://acme.com",
			error: "   Timeout after 60000ms   ",
		});
		expect(html).toContain("Timeout after 60000ms");
		expect(html).not.toContain("   Timeout after 60000ms");
	});
});

describe("UptimeAlertEmail — timing and numeric edge cases", () => {
	test("HTTP 0 (timeout) renders literally as 0", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			httpCode: 0,
		});
		expect(html).toMatch(/HTTP.*·.*0/);
	});

	test("checkedAt undefined renders em-dash placeholder", () => {
		const html = render({ kind: "down", url: "https://example.com" });
		expect(html).toMatch(/Checked at.*·.*—/);
	});

	test("checkedAt = NaN renders em-dash (not 'Invalid Date')", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			checkedAt: Number.NaN,
		});
		expect(html).not.toContain("Invalid Date");
		expect(html).toMatch(/Checked at.*·.*—/);
	});

	test("checkedAt = Infinity renders em-dash", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			checkedAt: Number.POSITIVE_INFINITY,
		});
		expect(html).not.toContain("Invalid Date");
		expect(html).toMatch(/Checked at.*·.*—/);
	});

	test("checkedAt = 0 (epoch) renders a formatted date, not em-dash", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			checkedAt: 0,
		});
		expect(html).toContain("1970");
	});

	test("fractional ttfb/total values round to integers", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			ttfbMs: 123.7,
			totalMs: 456.49,
		});
		expect(html).toContain("TTFB 124 ms");
		expect(html).toContain("total 456 ms");
	});

	test("ttfb/total undefined hide the Response row", () => {
		const html = render({ kind: "down", url: "https://example.com" });
		expect(html).not.toContain("Response · ");
	});

	test("only one of ttfb/total present still renders the Response row", () => {
		const htmlA = render({
			kind: "down",
			url: "https://example.com",
			ttfbMs: 50,
		});
		expect(htmlA).toContain("TTFB 50 ms");

		const htmlB = render({
			kind: "down",
			url: "https://example.com",
			totalMs: 200,
		});
		expect(htmlB).toContain("total 200 ms");
	});
});

describe("UptimeAlertEmail — SSL row", () => {
	test("sslValid undefined → no SSL row", () => {
		const html = render({ kind: "down", url: "https://example.com" });
		expect(html).not.toContain("SSL · ");
	});

	test("sslValid true with expiry renders 'Valid · expires …'", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			sslValid: true,
			sslExpiryMs: Date.UTC(2030, 0, 15),
		});
		expect(html).toContain("Valid");
		expect(html).toContain("2030");
	});

	test("sslValid true with no expiry renders just 'Valid'", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			sslValid: true,
		});
		expect(html).toContain("Valid");
		expect(html).not.toContain("expires");
	});

	test("sslValid false renders 'Invalid'", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			sslValid: false,
		});
		expect(html).toContain("Invalid");
	});

	test("sslExpiryMs = 0 is treated as missing", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			sslValid: true,
			sslExpiryMs: 0,
		});
		expect(html).not.toContain("expires");
	});

	test("sslExpiryMs = Infinity is treated as missing", () => {
		const html = render({
			kind: "down",
			url: "https://example.com",
			sslValid: true,
			sslExpiryMs: Number.POSITIVE_INFINITY,
		});
		expect(html).not.toContain("expires");
	});
});

describe("UptimeAlertEmail — preview text", () => {
	test("down preview mentions 'unreachable' with fallback label", () => {
		const html = render({ kind: "down", url: "https://example.com" });
		expect(html).toContain("is unreachable");
	});

	test("recovered preview mentions 'back online'", () => {
		const html = render({ kind: "recovered", url: "https://example.com" });
		expect(html).toContain("is back online");
	});
});
