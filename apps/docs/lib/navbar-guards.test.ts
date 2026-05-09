import { describe, expect, test } from "bun:test";
import { navMenu } from "../components/navbar";

const NAVBAR_PATH = `${import.meta.dir}/../components/navbar.tsx`;
const FEATURES_MENU_PATH = `${import.meta.dir}/../components/navbar-features-menu.tsx`;
const FOOTER_PATH = `${import.meta.dir}/../components/footer.tsx`;
const NAV_LINK_PATH = `${import.meta.dir}/../components/nav-link.tsx`;

async function readSource(path: string): Promise<string> {
	return await Bun.file(path).text();
}

describe("navbar regression guards", () => {
	test("nav-link.tsx exports NavLink", async () => {
		const src = await readSource(NAV_LINK_PATH);
		expect(src).toMatch(/export\s+function\s+NavLink\b/);
	});

	test("nav-link.tsx hard-codes data-track='nav_clicked'", async () => {
		const src = await readSource(NAV_LINK_PATH);
		expect(src).toMatch(/data-track\s*=\s*["']nav_clicked["']/);
	});

	test("nav-link.tsx emits data-section, data-nav-item, data-destination", async () => {
		const src = await readSource(NAV_LINK_PATH);
		expect(src).toMatch(/data-section=/);
		expect(src).toMatch(/data-nav-item=/);
		expect(src).toMatch(/data-destination=/);
	});

	test("navbar.tsx imports NavLink", async () => {
		const src = await readSource(NAVBAR_PATH);
		expect(src).toMatch(
			/import\s+\{\s*NavLink\s*\}\s+from\s+["']\.\/nav-link["']/
		);
	});

	test("navbar.tsx renders <NavLink> at least once", async () => {
		const src = await readSource(NAVBAR_PATH);
		expect(src).toMatch(/<NavLink\b/);
	});

	test("navbar-features-menu.tsx renders <NavLink> for menu items", async () => {
		const src = await readSource(FEATURES_MENU_PATH);
		expect(src).toMatch(/<NavLink\b/);
	});

	test("footer.tsx renders <NavLink> for footer nav items", async () => {
		const src = await readSource(FOOTER_PATH);
		expect(src).toMatch(/<NavLink\b/);
	});

	test("navMenu has at least one entry", () => {
		expect(navMenu.length).toBeGreaterThan(0);
	});

	test("every navMenu entry has a non-empty trackId", () => {
		for (const item of navMenu) {
			expect(item.trackId).toBeTruthy();
			expect(typeof item.trackId).toBe("string");
			expect(item.trackId.length).toBeGreaterThan(0);
		}
	});

	test("every navMenu entry has unique trackId", () => {
		const ids = navMenu.map((item) => item.trackId);
		const unique = new Set(ids);
		expect(unique.size).toBe(ids.length);
	});

	test("every navMenu entry trackId is snake_case-friendly (lowercase, alphanumerics + underscores + hyphens)", () => {
		for (const item of navMenu) {
			expect(item.trackId).toMatch(/^[a-z][a-z0-9_-]*$/);
		}
	});

	test("navbar.tsx still uses NavLink for the desktop nav menu loop", async () => {
		const src = await readSource(NAVBAR_PATH);
		expect(src).toMatch(/navMenu\.map[\s\S]*?<NavLink\b/);
	});

	test("navbar 'Start free' CTA is tagged with data-track='cta_clicked'", async () => {
		const src = await readSource(NAVBAR_PATH);
		expect(src).toMatch(/data-track=["']cta_clicked["']/);
		expect(src).toMatch(/data-placement=["']navbar["']/);
	});

	test("footer 'Start free' CTA is tagged with data-track='cta_clicked'", async () => {
		const src = await readSource(FOOTER_PATH);
		expect(src).toMatch(/data-track=["']cta_clicked["']/);
	});
});
