import { describe, expect, it } from "bun:test";
import { z } from "zod";

const folderSlugSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9_-]+$/);

const listLinkFoldersSchema = z
	.object({
		organizationId: z.string().optional(),
	})
	.default({});

const createLinkFolderSchema = z.object({
	organizationId: z.string().optional(),
	name: z.string().trim().min(1).max(80),
	slug: folderSlugSchema.optional(),
});

const updateLinkFolderSchema = z.object({
	id: z.string(),
	name: z.string().trim().min(1).max(80).optional(),
	slug: folderSlugSchema.optional(),
});

const deleteLinkFolderSchema = z.object({
	id: z.string(),
});

function slugifyFolderName(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s_-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	return slug || "folder";
}

describe("link folder schemas", () => {
	it("accepts folder creation with a name only", () => {
		const result = createLinkFolderSchema.safeParse({
			organizationId: "org-123",
			name: "Posts",
		});
		expect(result.success).toBe(true);
	});

	it("accepts valid explicit slugs", () => {
		for (const slug of ["posts", "social_posts", "campaign-2026"]) {
			const result = createLinkFolderSchema.safeParse({
				name: "Posts",
				slug,
			});
			expect(result.success).toBe(true);
		}
	});

	it("rejects invalid explicit slugs", () => {
		for (const slug of ["Posts", "social posts", "posts/team", ""]) {
			const result = createLinkFolderSchema.safeParse({
				name: "Posts",
				slug,
			});
			expect(result.success).toBe(false);
		}
	});

	it("accepts update and delete inputs", () => {
		expect(
			updateLinkFolderSchema.safeParse({
				id: "folder-123",
				name: "Product Posts",
			}).success
		).toBe(true);
		expect(deleteLinkFolderSchema.safeParse({ id: "folder-123" }).success).toBe(
			true
		);
	});

	it("accepts empty list input", () => {
		const result = listLinkFoldersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({});
		}
	});
});

describe("folder slug generation", () => {
	it("normalizes names into stable lowercase slugs", () => {
		expect(slugifyFolderName("Social Posts")).toBe("social-posts");
		expect(slugifyFolderName("  Q2_Campaigns  ")).toBe("q2-campaigns");
		expect(slugifyFolderName("Partner / Creator Links")).toBe(
			"partner-creator-links"
		);
	});

	it("falls back when the name has no slug-safe characters", () => {
		expect(slugifyFolderName("!!!")).toBe("folder");
	});
});
