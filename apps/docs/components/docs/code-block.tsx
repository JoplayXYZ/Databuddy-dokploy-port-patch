import { type ReactElement, type ReactNode, isValidElement } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import http from "shiki/langs/http.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import php from "shiki/langs/php.mjs";
import python from "shiki/langs/python.mjs";
import svelte from "shiki/langs/svelte.mjs";
import tsx from "shiki/langs/tsx.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import vesper from "shiki/themes/vesper.mjs";
import { CopyButton, cn } from "@databuddy/ui";

const highlighter = createHighlighterCoreSync({
	themes: [vesper, githubLight],
	langs: [tsx, jsx, html, css, json, markdown, bash, http, php, svelte, python],
	engine: createJavaScriptRegexEngine(),
});

function extractText(node: ReactNode): string {
	if (typeof node === "string") {
		return node;
	}
	if (typeof node === "number") {
		return String(node);
	}
	if (!node) {
		return "";
	}
	if (Array.isArray(node)) {
		return node.map(extractText).join("");
	}
	if (isValidElement(node)) {
		const el = node as ReactElement<{ children?: ReactNode }>;
		return extractText(el.props.children);
	}
	return "";
}

interface CodeBlockProps {
	children?: ReactNode;
	className?: string;
	code?: string;
	filename?: string;
	language?: string;
}

function CodeBlock({
	children,
	className,
	language = "text",
	filename,
	code,
}: CodeBlockProps) {
	const content = (code ?? children) as string;

	if (!content || typeof content !== "string") {
		return null;
	}

	let highlightedCode: string | null = null;

	if (language !== "text" && language !== "plaintext") {
		try {
			highlightedCode = highlighter.codeToHtml(content, {
				lang: language,
				themes: { light: "github-light", dark: "vesper" },
				defaultColor: false,
				transformers: [
					{
						pre(node) {
							node.properties.style = "";
							node.properties.tabindex = "-1";
						},
						code(node) {
							node.properties.style = "";
							node.properties.className = "border-none rounded-none";
						},
					},
				],
			});
		} catch {
			highlightedCode = null;
		}
	}

	const showHeader = language !== "text" || !!filename;

	return (
		<Shell
			copyValue={content}
			filename={filename}
			language={language}
			showHeader={showHeader}
		>
			{highlightedCode ? (
				<div
					className={cn(
						"font-mono! text-[13px] leading-relaxed",
						"[&>pre]:m-0 [&>pre]:overflow-visible [&>pre]:p-0 [&>pre]:leading-relaxed",
						"[&>pre>code]:block [&>pre>code]:w-full [&>pre>code]:overflow-x-auto [&>pre>code]:p-4",
						"[&_.line]:min-h-5",
						className
					)}
					dangerouslySetInnerHTML={{ __html: highlightedCode }}
				/>
			) : (
				<pre
					className={cn(
						"overflow-x-auto p-4 font-mono! text-foreground text-sm leading-relaxed",
						"[&>code]:block [&>code]:w-full [&>code]:p-0 [&>code]:text-inherit",
						className
					)}
					tabIndex={-1}
				>
					<code>{content}</code>
				</pre>
			)}
		</Shell>
	);
}

interface PreWrapperProps extends React.ComponentProps<"pre"> {}

function PreWrapper(props: PreWrapperProps) {
	const { children, className, ...rest } = props;

	const lang =
		className
			?.split(" ")
			.find((c) => c.startsWith("language-"))
			?.replace("language-", "") ?? undefined;

	const copyValue = extractText(children);

	return (
		<Shell copyValue={copyValue} language={lang} showHeader={!!lang}>
			<pre
				className={cn(
					"overflow-x-auto font-mono! text-[13px] leading-relaxed",
					"[&>code]:block [&>code]:w-full [&>code]:p-4",
					"[&_.line]:min-h-5",
					className
				)}
				tabIndex={-1}
				{...rest}
			>
				{children}
			</pre>
		</Shell>
	);
}

function Shell({
	children,
	copyValue,
	filename,
	language,
	showHeader,
}: {
	children: ReactNode;
	copyValue: string;
	filename?: string;
	language?: string;
	showHeader: boolean;
}) {
	return (
		<figure
			className="group/code not-prose relative my-4 w-full overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground text-sm transition-colors"
			dir="ltr"
		>
			{showHeader && (
				<div className="flex min-h-9 items-center justify-between border-border/60 border-b bg-secondary/50 px-3">
					<div className="flex min-w-0 items-center gap-2">
						{filename && (
							<span className="truncate font-medium text-foreground text-xs">
								{filename}
							</span>
						)}
						{language && (
							<span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
								{language}
							</span>
						)}
					</div>
					<CopyButton className="size-7 shrink-0" value={copyValue} />
				</div>
			)}

			{!showHeader && (
				<div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover/code:opacity-100">
					<CopyButton
						className="size-7 bg-card/90 backdrop-blur-md"
						value={copyValue}
					/>
				</div>
			)}

			<div className="relative max-h-[600px] overflow-auto">{children}</div>
		</figure>
	);
}

function InlineCode({ className, ...props }: React.ComponentProps<"code">) {
	return (
		<code
			className={cn(
				"not-prose rounded bg-secondary px-1.5 py-0.5 font-mono text-[13px] text-foreground/90",
				className
			)}
			{...props}
		/>
	);
}

export { CodeBlock, InlineCode, PreWrapper };
