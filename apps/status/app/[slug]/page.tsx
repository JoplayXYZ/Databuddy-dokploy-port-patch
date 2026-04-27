import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { getStatusPageUrl } from "@/lib/status-url";
import { rpcClient } from "@/lib/orpc";
import { StatusNavbar } from "./_components/status-navbar";
import { Status } from "./_components/status-page";

export const revalidate = 60;

interface StatusPageProps {
	params: Promise<{ slug: string }>;
}

const DAYS = 90;

async function getStatusData(slug: string) {
	return rpcClient.statusPage.getBySlug({ slug, days: DAYS }).catch(() => null);
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export async function generateMetadata({
	params,
}: StatusPageProps): Promise<Metadata> {
	const { slug } = await params;
	const data = await getStatusData(slug);

	if (!data) {
		return {
			title: "Status Page",
			description: "System status and uptime monitoring",
		};
	}

	const title = `${data.statusPage.name || data.organization.name} Status`;
	const description =
		data.statusPage.description ||
		`Real-time system status for ${data.organization.name}`;
	const url = getStatusPageUrl(slug);
	const faviconUrl = data.statusPage.faviconUrl;

	return {
		title,
		description,
		...(faviconUrl
			? { icons: { icon: faviconUrl, shortcut: faviconUrl } }
			: {}),
		alternates: { canonical: `/${slug}` },
		openGraph: {
			title,
			description,
			url,
			type: "website",
			siteName: data.organization.name,
		},
		twitter: { card: "summary_large_image", title, description },
	};
}

function resolveTheme(
	theme: string | null | undefined
): "system" | "light" | "dark" {
	if (theme === "light" || theme === "dark") {
		return theme;
	}
	return "system";
}

export default async function StatusPage({ params }: StatusPageProps) {
	const { slug } = await params;
	const data = await getStatusData(slug);

	if (!data) {
		notFound();
	}

	const { statusPage: page } = data;
	const theme = resolveTheme(page.theme);
	const forcedTheme = theme === "system" ? undefined : theme;

	const latestTimestamp = data.monitors.reduce<string | null>(
		(latest, monitor) => {
			if (!monitor.lastCheckedAt) {
				return latest;
			}
			if (!latest || monitor.lastCheckedAt > latest) {
				return monitor.lastCheckedAt;
			}
			return latest;
		},
		null
	);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: `${page.name || data.organization.name} Status`,
		description:
			page.description ||
			`Real-time system status for ${data.organization.name}`,
		url: getStatusPageUrl(slug),
		publisher: {
			"@type": "Organization",
			name: data.organization.name,
			...(data.organization.logo ? { logo: data.organization.logo } : {}),
		},
	};

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme={theme}
			enableSystem={theme === "system"}
			forcedTheme={forcedTheme}
		>
			<div className="flex h-dvh flex-col overflow-hidden bg-background">
				<StatusNavbar
					logoUrl={page.logoUrl}
					supportUrl={page.supportUrl}
					websiteUrl={page.websiteUrl}
				/>

				<main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					<div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
						<script
							dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
							type="application/ld+json"
						/>

						{page.customCss ? (
							<style
								dangerouslySetInnerHTML={{
									__html: page.customCss.replaceAll(/<\/style/gi, "<\\/style"),
								}}
							/>
						) : null}

						<Status>
							<Status.Header
								description={page.description ?? undefined}
								logoUrl={page.logoUrl}
								name={page.name}
								status={data.overallStatus}
								websiteUrl={page.websiteUrl}
							/>

							<Status.IncidentList incidents={data.incidents} />

							<Status.MonitorList>
								{data.monitors.map((monitor) => (
									<Status.MonitorCard
										anchorId={slugify(monitor.name)}
										currentStatus={monitor.currentStatus}
										dailyData={monitor.dailyData}
										days={DAYS}
										domain={monitor.domain ?? undefined}
										id={monitor.id}
										key={monitor.id}
										name={monitor.name}
										uptimePercentage={monitor.uptimePercentage ?? undefined}
									/>
								))}
							</Status.MonitorList>

							<Status.Footer
								incidents={data.incidents}
								timestamp={latestTimestamp}
							/>
						</Status>
					</div>
				</main>

				{page.hideBranding ? null : (
					<footer className="shrink-0 border-border/50 border-t bg-background">
						<div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4 sm:px-6">
							<p className="text-[11px] text-muted-foreground/50 tracking-wide">
								Powered by{" "}
								<a
									className="text-muted-foreground/70 transition-colors hover:text-foreground"
									href="https://www.databuddy.cc"
									rel="noopener noreferrer dofollow"
									target="_blank"
								>
									Databuddy
								</a>
							</p>
						</div>
					</footer>
				)}
			</div>
		</ThemeProvider>
	);
}
