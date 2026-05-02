import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string[] }> }
) {
	const { slug } = await params;
	const slugPath = slug.join("/");
	const basePath = path.join(process.cwd(), "content/docs");
	const candidates = [
		path.join(basePath, `${slugPath}.mdx`),
		path.join(basePath, slugPath, "index.mdx"),
	];

	for (const filePath of candidates) {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const { content: markdown, data } = matter(content);

			const header = data.title ? `# ${data.title}\n\n` : "";
			const description = data.description ? `> ${data.description}\n\n` : "";

			const body = header + description + markdown;

			return new Response(body, {
				headers: {
					"Content-Type": "text/markdown; charset=utf-8",
					"Cache-Control": "public, max-age=3600, must-revalidate",
					ETag: `"${Buffer.from(body).length.toString(36)}"`,
				},
			});
		} catch {
			continue;
		}
	}

	return new Response("Not found", { status: 404 });
}
