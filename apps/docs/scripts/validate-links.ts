import path from "node:path";
import {
	type FileObject,
	printErrors,
	readFiles,
	scanURLs,
	validateFiles,
} from "next-validate-link";

const DOCS_DIR = path.join(process.cwd(), "content/docs");
const DOCS_PATTERN = "content/docs/**/*.mdx";
const EXPLICIT_HEADING_ID_REGEX = /\s+\{#[^}]+\}\s*$/;
const HEADING_REGEX = /^(#{2,6})\s+(.+)$/;
const HTML_TAG_REGEX = /<[^>]+>/g;
const MARKDOWN_FORMATTING_REGEX = /[`*_~[\]]/g;
const MARKDOWN_LINK_TARGET_REGEX = /\]\([^)]+\)/g;
const MDX_EXTENSION_REGEX = /\.mdx$/;
const NON_SLUG_CHARS_REGEX = /[^\w\s-]/g;
const REPEATED_DASH_REGEX = /-+/g;
const WHITESPACE_REGEX = /\s+/g;

interface DocsPage {
	hashes: string[];
	slugs: string[];
}

function getSlugsFromPath(file: string): string[] {
	const relative = path.relative(DOCS_DIR, file);
	const withoutExt = relative.replace(MDX_EXTENSION_REGEX, "");
	const segments = withoutExt.split(path.sep);
	return segments.at(-1) === "index" ? segments.slice(0, -1) : segments;
}

function getUrlFromSlugs(slugs: string[]): string {
	return slugs.length === 0 ? "/docs" : `/docs/${slugs.join("/")}`;
}

function slugifyHeading(value: string): string {
	return value
		.replace(EXPLICIT_HEADING_ID_REGEX, "")
		.replace(HTML_TAG_REGEX, "")
		.replace(MARKDOWN_LINK_TARGET_REGEX, "")
		.replace(MARKDOWN_FORMATTING_REGEX, "")
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(NON_SLUG_CHARS_REGEX, "")
		.replace(WHITESPACE_REGEX, "-")
		.replace(REPEATED_DASH_REGEX, "-");
}

function getHeadings(content: string): string[] {
	const seen = new Map<string, number>();
	return content
		.split("\n")
		.map((line) => line.match(HEADING_REGEX)?.[2])
		.filter((heading): heading is string => Boolean(heading))
		.map((heading) => {
			const slug = slugifyHeading(heading);
			const count = seen.get(slug) ?? 0;
			seen.set(slug, count + 1);
			return count === 0 ? slug : `${slug}-${count}`;
		});
}

function getDocsPages(files: FileObject[]): DocsPage[] {
	return files.map((file) => {
		const slugs = getSlugsFromPath(path.resolve(file.path));
		return {
			hashes: getHeadings(file.content),
			slugs,
		};
	});
}

function pathToUrl(file: string): string | undefined {
	const absolute = path.resolve(file);
	if (!(absolute.startsWith(DOCS_DIR) && absolute.endsWith(".mdx"))) {
		return;
	}
	return getUrlFromSlugs(getSlugsFromPath(absolute));
}

const getFiles = (): Promise<FileObject[]> =>
	readFiles(DOCS_PATTERN, { pathToUrl });

async function checkLinks() {
	const files = await getFiles();
	const pages = getDocsPages(files);

	const scanned = await scanURLs({
		preset: "next",
		populate: {
			"docs/[[...slug]]": pages.map((page) => ({
				value: { slug: page.slugs },
				hashes: page.hashes,
			})),
		},
	});

	const errors = await validateFiles(files, {
		scanned,
		markdown: {
			components: {
				Card: { attributes: ["href"] },
				Cards: { attributes: ["href"] },
				Link: { attributes: ["href"] },
			},
		},
		checkRelativePaths: "as-url",
	});

	printErrors(errors, true);

	if (errors.length > 0) {
		process.exit(1);
	}
}

checkLinks().catch((error) => {
	console.error(error);
	process.exit(1);
});
