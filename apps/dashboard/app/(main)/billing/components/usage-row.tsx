"use client";

import {
	IconAlertWarningFillDuo18,
	IconBoltLightningFillDuo18,
	IconChartBarTrendUpFillDuo18,
	IconClockFillDuo18,
	IconDatabaseFillDuo18,
	IconGiftFillDuo18,
	IconUsersFillDuo18,
} from "nucleo-ui-fill-duo-18";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatLocaleNumber } from "@/lib/format-locale-number";
import { cn } from "@/lib/utils";
import {
	type FeatureUsage,
	formatCompactNumber,
	getResetText,
} from "../utils/feature-usage";
import { PricingTiersTooltip } from "./pricing-tiers-tooltip";

function formatCurrency(amount: number): string {
	if (amount >= 1000) {
		return `$${(amount / 1000).toFixed(1)}K`;
	}
	if (amount >= 1) {
		return `$${amount.toFixed(2)}`;
	}
	return `$${amount.toFixed(4)}`;
}

const FEATURE_ICONS: Record<string, typeof IconChartBarTrendUpFillDuo18> = {
	event: IconChartBarTrendUpFillDuo18,
	storage: IconDatabaseFillDuo18,
	user: IconUsersFillDuo18,
	member: IconUsersFillDuo18,
	message: IconChartBarTrendUpFillDuo18,
	website: IconChartBarTrendUpFillDuo18,
};

function getFeatureIcon(name: string): typeof IconChartBarTrendUpFillDuo18 {
	const lowercaseName = name.toLowerCase();
	for (const [key, Icon] of Object.entries(FEATURE_ICONS)) {
		if (lowercaseName.includes(key)) {
			return Icon;
		}
	}
	return IconChartBarTrendUpFillDuo18;
}

export const UsageRow = memo(function UsageRowComponent({
	feature,
	isMaxPlan = false,
}: {
	feature: FeatureUsage;
	isMaxPlan?: boolean;
}) {
	const used = feature.includedLimit - feature.balance;
	const usedClamped = Math.max(0, used);
	const hasNormalLimit = !(feature.unlimited || feature.hasExtraCredits);
	const hasOverage = feature.overage !== null;
	const isBilledOverage = hasOverage && feature.hasPricedOverage;

	const Icon = getFeatureIcon(feature.name);
	const intervalLabel = feature.interval
		? ({ day: "Daily", month: "Monthly", year: "Yearly", lifetime: "Lifetime" }[
				feature.interval
			] ?? null)
		: null;

	if (isBilledOverage && feature.overage) {
		return (
			<BilledOverageRow
				feature={feature}
				Icon={Icon}
				intervalLabel={intervalLabel}
			/>
		);
	}

	const usedPercent = feature.unlimited
		? 0
		: Math.min(Math.max((usedClamped / feature.includedLimit) * 100, 0), 100);
	const isLow = hasNormalLimit && usedPercent > 80;

	return (
		<div className="border-b p-5">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded border bg-background">
						<Icon
							className="text-muted-foreground"
							size={18}
						/>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<span className="font-medium">{feature.name}</span>
							{feature.hasExtraCredits && (
								<Badge variant="secondary">
									<IconGiftFillDuo18 className="mr-1" size={10} />
									Bonus
								</Badge>
							)}
							{hasOverage && !isBilledOverage && (
								<Badge
									className="bg-destructive/10 text-destructive"
									variant="secondary"
								>
									<IconAlertWarningFillDuo18 className="mr-1" size={10} />
									Limit reached
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-1 text-muted-foreground text-sm">
							<IconClockFillDuo18 size={12} />
							{getResetText(feature)}
						</div>
					</div>
				</div>

				{feature.unlimited ? (
					<Badge variant="secondary">
						<IconBoltLightningFillDuo18 className="mr-1" size={12} />
						Unlimited
					</Badge>
				) : feature.hasExtraCredits ? (
					<div className="text-balance text-right">
						<span className="font-mono text-base tabular-nums">
							{formatCompactNumber(0)} /{" "}
							{formatCompactNumber(feature.includedLimit)} used
						</span>
						<div className="text-muted-foreground text-xs">
							{formatCompactNumber(feature.balance - feature.includedLimit)}{" "}
							bonus remaining
						</div>
					</div>
				) : feature.overage ? (
					<div className="text-right">
						<span className="font-mono text-base text-destructive tabular-nums">
							+{formatCompactNumber(feature.overage.amount)} over
						</span>
						<div className="text-destructive text-xs">
							~{formatCurrency(feature.overage.cost)} overage
						</div>
					</div>
				) : (
					<div className="text-balance text-right">
						<span
							className={cn(
								"font-mono text-base tabular-nums",
								isLow ? "text-warning" : "text-foreground"
							)}
						>
							{formatCompactNumber(usedClamped)} /{" "}
							{formatCompactNumber(feature.includedLimit)}
						</span>
						<div className="text-muted-foreground text-xs">
							{usedClamped === 0
								? `${formatCompactNumber(feature.includedLimit)} available`
								: "used"}
						</div>
					</div>
				)}
			</div>

			{!feature.unlimited && (
				<div className="flex items-center gap-3">
					<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full transition-all",
								hasOverage
									? "bg-destructive"
									: isLow
										? "bg-warning"
										: "bg-primary"
							)}
							style={{ width: hasOverage ? "100%" : `${usedPercent}%` }}
						/>
					</div>
					{(isLow || hasOverage) && !isMaxPlan ? (
						<Link
							className="shrink-0 font-medium text-primary text-sm hover:underline"
							href="/billing/plans"
						>
							Upgrade
						</Link>
					) : null}
				</div>
			)}
		</div>
	);
});

function BilledOverageRow({
	feature,
	Icon,
	intervalLabel,
}: {
	feature: FeatureUsage;
	Icon: typeof IconChartBarTrendUpFillDuo18;
	intervalLabel: string | null;
}) {
	const overage = feature.overage;
	if (!overage) {
		return null;
	}

	const totalUsed = feature.limit + overage.amount;
	const includedPercent = Math.max(
		(feature.limit / (feature.limit + overage.amount)) * 100,
		5
	);

	return (
		<div className="border-b p-5">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded border bg-background">
						<Icon
							className="text-muted-foreground"
							size={18}
						/>
					</div>
					<div>
						<span className="font-medium">{feature.name}</span>
						<div className="flex items-center gap-1 text-muted-foreground text-sm">
							<IconClockFillDuo18 size={12} />
							{getResetText(feature)}
						</div>
					</div>
				</div>
				{intervalLabel && (
					<span className="text-muted-foreground text-sm">
						{intervalLabel} usage
					</span>
				)}
			</div>

			<div className="mb-3">
				<div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						className="h-full bg-primary"
						style={{ width: `${includedPercent}%` }}
					/>
					<div
						className="h-full bg-primary/30"
						style={{ width: `${100 - includedPercent}%` }}
					/>
				</div>
				<div className="mt-1.5 flex items-center justify-between text-xs">
					<div className="flex items-center gap-3">
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-2 rounded-full bg-primary" />
							<span className="text-muted-foreground">
								{formatCompactNumber(feature.limit)} included
							</span>
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-2 rounded-full bg-primary/30" />
							<span className="text-muted-foreground">
								{formatCompactNumber(overage.amount)} overage
							</span>
						</span>
					</div>
					<span className="font-medium font-mono tabular-nums">
						{formatLocaleNumber(totalUsed)} total
					</span>
				</div>
			</div>

			{/* Cost + pricing tiers */}
			<div className="flex items-center justify-between rounded border bg-secondary/50 px-3 py-2">
				<div className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">Estimated overage cost</span>
					<span className="font-medium font-mono tabular-nums">
						~{formatCurrency(overage.cost)}
					</span>
				</div>
				<div className="flex items-center gap-3">
					{feature.pricingTiers.length > 0 && (
						<PricingTiersTooltip tiers={feature.pricingTiers} />
					)}
					<Link
						className="font-medium text-primary text-xs hover:underline"
						href="#breakdown"
					>
						View breakdown
					</Link>
				</div>
			</div>
		</div>
	);
}
