import {
	ArrowRightIcon,
	FlagIcon,
	LightningIcon,
	ShieldCheckIcon,
	SlidersHorizontalIcon,
	TargetIcon,
	UsersIcon,
} from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { SciFiGridCard } from "@/components/landing/card";
import { FaqSection } from "@/components/landing/faq-section";
import { SciFiButton } from "@/components/landing/scifi-btn";
import Section from "@/components/landing/section";
import { Spotlight } from "@/components/landing/spotlight";
import { StructuredData } from "@/components/structured-data";

export const metadata: Metadata = {
	title: "Feature Flags & A/B Testing | Databuddy",
	description:
		"Ship features safely with instant rollouts, percentage-based releases, A/B testing, and user targeting. No deploys needed — control everything from your dashboard.",
	alternates: {
		canonical: "https://www.databuddy.cc/feature-flags",
	},
	openGraph: {
		title: "Feature Flags & A/B Testing | Databuddy",
		description:
			"Ship features safely with instant rollouts, percentage-based releases, A/B testing, and user targeting. No deploys needed — control everything from your dashboard.",
		url: "https://www.databuddy.cc/feature-flags",
		images: ["/og-image.png"],
	},
};

const FEATURES = [
	{
		icon: LightningIcon,
		title: "Instant Rollouts",
		description:
			"Toggle features on or off from your dashboard. No deploys, no waiting — changes take effect immediately.",
	},
	{
		icon: SlidersHorizontalIcon,
		title: "Percentage Rollouts",
		description:
			"Gradually release features to 1%, 10%, 50% of users. Ramp up with confidence, roll back in one click.",
	},
	{
		icon: TargetIcon,
		title: "A/B Testing",
		description:
			"Run multivariant experiments with weighted traffic splits. Users get consistent assignments across sessions.",
	},
	{
		icon: UsersIcon,
		title: "User Targeting",
		description:
			"Target by user, organization, team, or custom properties like plan, region, or signup date.",
	},
	{
		icon: ShieldCheckIcon,
		title: "SSR-Safe Defaults",
		description:
			"Built-in loading states and default values prevent flash of incorrect content during server rendering.",
	},
	{
		icon: FlagIcon,
		title: "Request Batching",
		description:
			"Multiple flag checks within 10ms are batched into a single API call. Stale-while-revalidate keeps the UI instant.",
	},
] as const;

const FAQ_ITEMS = [
	{
		question: "Will feature flags slow down my app?",
		answer:
			"No. Flags load once and are cached locally, so your users never see a delay. Pages render just as fast with flags as without — there's no visible performance impact.",
	},
	{
		question: "Can I roll out a feature to just one team or customer first?",
		answer:
			"Yes. You can release to specific users, entire organizations, or teams before opening it up to everyone. This means you can validate with your biggest customer before a wider launch.",
	},
	{
		question: "What happens if something goes wrong after a release?",
		answer:
			"One click and the feature is off — no deploy, no rollback, no downtime. Your users see the previous experience immediately while you fix the issue.",
	},
	{
		question: "Can I run A/B tests to see which version performs better?",
		answer:
			"Yes. Create multiple variants, split traffic by percentage, and each user consistently sees the same version across sessions. You can measure which variant drives better outcomes and scale the winner.",
	},
	{
		question: "Are feature flags included in all plans?",
		answer:
			"Every plan includes feature flags — the free plan gives you 3 flags to start, and paid plans scale from there. No add-ons or hidden costs.",
	},
] as const;

const DEMO_FLAGS = [
	{
		name: "new-dashboard",
		label: "New Dashboard",
		type: "boolean" as const,
		enabled: true,
		env: "prod",
	},
	{
		name: "checkout-experiment",
		label: "Checkout Experiment",
		type: "multivariant" as const,
		enabled: true,
		env: "prod",
		variants: [
			{ name: "control", weight: 50 },
			{ name: "simplified", weight: 30 },
			{ name: "one-click", weight: 20 },
		],
	},
	{
		name: "ai-assistant",
		label: "AI Assistant",
		type: "rollout" as const,
		enabled: true,
		env: "beta",
		rollout: 25,
	},
	{
		name: "dark-mode-v2",
		label: "Dark Mode V2",
		type: "boolean" as const,
		enabled: false,
		env: "dev",
	},
] as const;

const VARIANT_COLORS = [
	"bg-emerald-500",
	"bg-sky-500",
	"bg-amber-500",
	"bg-rose-500",
] as const;

function FlagTypeBadge({
	type,
}: {
	type: "boolean" | "rollout" | "multivariant";
}) {
	const styles = {
		boolean: "bg-sky-500/10 text-sky-400",
		rollout: "bg-violet-500/10 text-violet-400",
		multivariant: "bg-amber-500/10 text-amber-400",
	} as const;

	return (
		<span
			className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[type]}`}
		>
			{type}
		</span>
	);
}

function RolloutBar({ percent }: { percent: number }) {
	return (
		<div className="flex items-center gap-2">
			<div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
				<div
					className="h-full rounded bg-violet-500"
					style={{ width: `${String(percent)}%` }}
				/>
			</div>
			<span className="font-mono text-[10px] text-muted-foreground tabular-nums">
				{percent}%
			</span>
		</div>
	);
}

function VariantBar({
	variants,
}: {
	variants: ReadonlyArray<{ name: string; weight: number }>;
}) {
	return (
		<div className="flex items-center gap-2">
			<div className="flex h-1.5 w-16 overflow-hidden rounded">
				{variants.map((v, i) => (
					<div
						className={`h-full ${VARIANT_COLORS.at(i % VARIANT_COLORS.length)}`}
						key={v.name}
						style={{ width: `${String(v.weight)}%` }}
					/>
				))}
			</div>
			<span className="font-mono text-[10px] text-muted-foreground tabular-nums">
				{variants.length}v
			</span>
		</div>
	);
}

function FlagsDashboardDemo() {
	return (
		<div className="overflow-hidden rounded border border-border/50 bg-card/30 shadow-2xl backdrop-blur-sm">
			<div className="border-border border-b px-5 py-4">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h3 className="font-semibold text-foreground text-sm">
							Feature Flags
						</h3>
						<p className="text-muted-foreground text-xs">4 flags · 3 active</p>
					</div>
					<div className="flex items-center gap-2 rounded bg-foreground/5 px-3 py-1.5">
						<FlagIcon
							className="size-3.5 text-muted-foreground"
							weight="duotone"
						/>
						<span className="font-medium text-muted-foreground text-xs">
							Production
						</span>
					</div>
				</div>
			</div>

			<div className="divide-y divide-border/50">
				{DEMO_FLAGS.map((flag) => (
					<div
						className="flex items-center justify-between px-5 py-3.5"
						key={flag.name}
					>
						<div className="flex items-center gap-3">
							<div
								className={`size-2 shrink-0 rounded-full ${
									flag.enabled
										? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
										: "bg-muted-foreground/30"
								}`}
							/>
							<div className="flex flex-col gap-0.5">
								<div className="flex items-center gap-2">
									<span className="font-medium text-foreground text-xs">
										{flag.label}
									</span>
									<FlagTypeBadge type={flag.type} />
								</div>
								<span className="font-mono text-[10px] text-muted-foreground">
									{flag.name}
								</span>
							</div>
						</div>
						<div className="flex items-center gap-3">
							{"rollout" in flag && flag.rollout !== undefined && (
								<RolloutBar percent={flag.rollout} />
							)}
							{"variants" in flag && flag.variants !== undefined && (
								<VariantBar variants={flag.variants} />
							)}
							<span
								className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
									flag.env === "prod"
										? "bg-emerald-500/10 text-emerald-400"
										: flag.env === "beta"
											? "bg-amber-500/10 text-amber-400"
											: "bg-muted text-muted-foreground"
								}`}
							>
								{flag.env}
							</span>
						</div>
					</div>
				))}
			</div>

			<div className="border-border border-t px-5 py-3">
				<div className="flex items-center gap-4 text-[10px] text-muted-foreground">
					<div className="flex items-center gap-1.5">
						<span className="size-1.5 rounded-full bg-emerald-500" />
						<span>Active</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="size-1.5 rounded-full bg-muted-foreground/30" />
						<span>Inactive</span>
					</div>
					<span className="ml-auto font-mono tabular-nums">
						Last evaluated 2s ago
					</span>
				</div>
			</div>
		</div>
	);
}

export default function FeatureFlagsPage() {
	return (
		<>
			<StructuredData
				elements={[{ type: "faq", items: [...FAQ_ITEMS] }]}
				page={{
					title: "Feature Flags & A/B Testing | Databuddy",
					description:
						"Ship features safely with instant rollouts, percentage-based releases, A/B testing, and user targeting.",
					url: "https://www.databuddy.cc/feature-flags",
				}}
			/>
			<div className="overflow-hidden">
				{/* Hero */}
				<Section className="overflow-hidden" customPaddings id="hero">
					<section className="relative flex w-full flex-col items-center overflow-hidden">
						<Spotlight transform="translateX(-60%) translateY(-50%)" />

						<div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-8 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
							<div className="mx-auto flex max-w-4xl flex-col items-center space-y-8 text-center">
								<h1 className="text-balance font-bold text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
									Ship features safely.{" "}
									<span className="text-muted-foreground">
										Roll back in one click.
									</span>
								</h1>

								<p className="max-w-2xl text-pretty font-medium text-muted-foreground text-sm leading-relaxed sm:text-base lg:text-lg">
									Boolean toggles, percentage rollouts, and A/B experiments —
									controlled from your dashboard, no deploys needed. Built into
									Databuddy.
								</p>

								<div className="flex items-center gap-3">
									<SciFiButton asChild className="px-6 py-5 text-base sm:px-8">
										<a href="https://app.databuddy.cc/login">
											Create your first flag
										</a>
									</SciFiButton>
									<SciFiButton asChild className="px-6 py-5 text-base sm:px-8">
										<Link href="/docs/sdk/feature-flags">Read the docs</Link>
									</SciFiButton>
								</div>

								<p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
									<span>No credit card required</span>
									<span className="text-border">·</span>
									<span>3 flags free</span>
									<span className="text-border">·</span>
									<span>React, Vue &amp; Node.js</span>
								</p>
							</div>

							<div className="mx-auto mt-8 max-w-2xl">
								<FlagsDashboardDemo />
							</div>
						</div>
					</section>
				</Section>

				{/* Feature Grid */}
				<Section className="border-border border-b" id="features">
					<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="mb-12 text-center lg:mb-16 lg:text-left">
							<h2 className="mx-auto max-w-4xl text-balance font-semibold text-3xl leading-tight sm:text-4xl lg:mx-0 lg:text-5xl">
								<span className="text-muted-foreground">Deploy once, </span>
								<span className="bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
									control everything
								</span>
							</h2>
							<p className="mt-3 max-w-2xl text-pretty text-muted-foreground text-sm sm:px-0 sm:text-base lg:text-lg">
								From kill switches to multivariant experiments — everything you
								need to ship with confidence.
							</p>
						</div>

						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10 xl:gap-12">
							{FEATURES.map((feature) => (
								<div className="flex" key={feature.title}>
									<SciFiGridCard
										description={feature.description}
										icon={feature.icon}
										title={feature.title}
									/>
								</div>
							))}
						</div>
					</div>
				</Section>

				{/* Mid-page CTA */}
				<Section className="border-border border-b bg-background/50" id="cta">
					<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="mx-auto flex max-w-2xl flex-col items-center space-y-6 text-center">
							<h2 className="text-balance font-semibold text-3xl leading-tight sm:text-4xl">
								Your first flag, live in 2 minutes
							</h2>
							<p className="max-w-lg text-pretty text-muted-foreground text-sm sm:text-base">
								Install the SDK, wrap your app in FlagsProvider, and call
								useFeature. That&apos;s it — manage everything else from the
								dashboard.
							</p>
							<SciFiButton asChild className="px-6 py-5 text-base sm:px-8">
								<a href="https://app.databuddy.cc/login">
									Get started free
									<ArrowRightIcon className="ml-2 size-4" weight="bold" />
								</a>
							</SciFiButton>
						</div>
					</div>
				</Section>

				{/* FAQ */}
				<Section className="border-border border-b bg-background/30" id="faq">
					<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
						<FaqSection items={[...FAQ_ITEMS]} />
					</div>
				</Section>

				{/* Gradient Divider */}
				<div className="w-full">
					<div className="mx-auto h-px max-w-6xl bg-linear-to-r from-transparent via-border/30 to-transparent" />
				</div>

				<Footer />

				<div className="w-full">
					<div className="mx-auto h-px max-w-6xl bg-linear-to-r from-transparent via-border/30 to-transparent" />
				</div>
			</div>
		</>
	);
}
