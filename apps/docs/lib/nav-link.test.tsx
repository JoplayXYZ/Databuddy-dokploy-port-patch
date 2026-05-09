import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NavLink } from "../components/nav-link";

describe("NavLink", () => {
	test("emits data-track='nav_clicked' on every render", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/docs" navItem="docs">
				Docs
			</NavLink>
		);
		expect(html).toContain('data-track="nav_clicked"');
	});

	test("includes nav-item attribute matching the prop", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/pricing" navItem="pricing">
				Pricing
			</NavLink>
		);
		expect(html).toContain('data-nav-item="pricing"');
	});

	test("default section is 'navbar' when not specified", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/x" navItem="x">
				X
			</NavLink>
		);
		expect(html).toContain('data-section="navbar"');
	});

	test("respects explicit section prop", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/x" navItem="x" section="footer">
				X
			</NavLink>
		);
		expect(html).toContain('data-section="footer"');
		expect(html).not.toContain('data-section="navbar"');
	});

	test("internal links get data-destination='internal'", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/docs" navItem="docs">
				Docs
			</NavLink>
		);
		expect(html).toContain('data-destination="internal"');
	});

	test("external links get data-destination='external' + target+rel defaults", () => {
		const html = renderToStaticMarkup(
			<NavLink external href="https://github.com/x" navItem="github">
				GitHub
			</NavLink>
		);
		expect(html).toContain('data-destination="external"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	test("renders as <a> tag (whether external or internal)", () => {
		const externalHtml = renderToStaticMarkup(
			<NavLink external href="https://x.com" navItem="x">
				X
			</NavLink>
		);
		const internalHtml = renderToStaticMarkup(
			<NavLink href="/x" navItem="x">
				X
			</NavLink>
		);
		expect(externalHtml.startsWith("<a")).toBe(true);
		expect(internalHtml.startsWith("<a")).toBe(true);
	});

	test("preserves children", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/x" navItem="x">
				Click <strong>here</strong>
			</NavLink>
		);
		expect(html).toContain("Click <strong>here</strong>");
	});

	test("preserves className", () => {
		const html = renderToStaticMarkup(
			<NavLink className="custom-class" href="/x" navItem="x">
				X
			</NavLink>
		);
		expect(html).toContain('class="custom-class"');
	});

	test("preserves href on internal links", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/pricing" navItem="pricing">
				Pricing
			</NavLink>
		);
		expect(html).toContain('href="/pricing"');
	});

	test("preserves href on external links", () => {
		const html = renderToStaticMarkup(
			<NavLink external href="https://github.com/databuddy" navItem="github">
				GitHub
			</NavLink>
		);
		expect(html).toContain('href="https://github.com/databuddy"');
	});

	test("respects custom rel prop on external link", () => {
		const html = renderToStaticMarkup(
			<NavLink
				external
				href="https://x.com"
				navItem="twitter"
				rel="me"
			>
				X
			</NavLink>
		);
		expect(html).toContain('rel="me"');
	});

	test("supports navbar_features section variant", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/uptime" navItem="uptime" section="navbar_features">
				Uptime
			</NavLink>
		);
		expect(html).toContain('data-section="navbar_features"');
	});

	test("supports navbar_mobile section variant", () => {
		const html = renderToStaticMarkup(
			<NavLink href="/docs" navItem="docs" section="navbar_mobile">
				Docs
			</NavLink>
		);
		expect(html).toContain('data-section="navbar_mobile"');
	});

	test("emits all four required tracking attributes together", () => {
		const html = renderToStaticMarkup(
			<NavLink external href="https://x.com" navItem="github" section="footer">
				X
			</NavLink>
		);
		expect(html).toContain('data-track="nav_clicked"');
		expect(html).toContain('data-section="footer"');
		expect(html).toContain('data-nav-item="github"');
		expect(html).toContain('data-destination="external"');
	});
});
