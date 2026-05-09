import {
	FEATURE_METADATA,
	type FeatureLimit,
	GATED_FEATURES,
	type GatedFeatureId,
	HIDDEN_PRICING_FEATURES,
	PLAN_FEATURE_LIMITS,
	PLAN_HIERARCHY,
	PLAN_IDS,
	type PlanId,
} from "@databuddy/shared/types/features";
import { XMarkIcon as XIcon } from "@databuddy/ui/icons";
import type { ReactNode } from "react";

/** Docs pricing column ids → shared plan ids (enterprise maps to Scale limits). */
const TABLE_PLAN_TO_SHARED: Record<string, PlanId> = {
	free: PLAN_IDS.FREE,
	hobby: PLAN_IDS.HOBBY,
	pro: PLAN_IDS.PRO,
	enterprise: PLAN_IDS.SCALE,
};

function isUnlimitedOnAllPlans(featureId: GatedFeatureId): boolean {
	for (const planId of PLAN_HIERARCHY) {
		const limit = PLAN_FEATURE_LIMITS[planId][featureId];
		if (limit !== "unlimited") {
			return false;
		}
	}
	return true;
}

function pricingVisibleGatedFeatures(): GatedFeatureId[] {
	return (Object.values(GATED_FEATURES) as GatedFeatureId[])
		.filter((id) => !HIDDEN_PRICING_FEATURES.includes(id))
		.filter((id) => !isUnlimitedOnAllPlans(id));
}

function FeatureX() {
	return (
		<span className="inline-flex items-center justify-center">
			<XIcon className="size-4 text-muted-foreground" weight="bold" />
		</span>
	);
}

function formatLimitCell(
	limit: FeatureLimit,
	featureId: GatedFeatureId
): ReactNode {
	if (limit === false) {
		return <FeatureX />;
	}
	if (limit === "unlimited") {
		return <span>Unlimited</span>;
	}
	const meta = FEATURE_METADATA[featureId];
	const unit = meta.unit;
	return (
		<div className="flex flex-col items-center gap-0.5">
			<span className="tabular-nums">{limit.toLocaleString()}</span>
			{unit ? (
				<span className="text-muted-foreground text-xs">{unit}</span>
			) : null}
		</div>
	);
}

function GatedLimitCell({
	featureId,
	tablePlanId,
}: {
	featureId: GatedFeatureId;
	tablePlanId: string;
}) {
	const sharedPlan = TABLE_PLAN_TO_SHARED[tablePlanId];
	if (sharedPlan == null) {
		return <FeatureX />;
	}
	const limit = PLAN_FEATURE_LIMITS[sharedPlan][featureId];
	return formatLimitCell(limit, featureId);
}

interface GatedFeaturePricingRowsProps {
	plans: Array<{ id: string }>;
	planTdClassName: (planId: string) => string;
}

export function GatedFeaturePricingRows({
	plans,
	planTdClassName,
}: GatedFeaturePricingRowsProps) {
	const features = pricingVisibleGatedFeatures();
	if (features.length === 0) {
		return null;
	}

	const colSpan = 1 + plans.length;

	return (
		<>
			<tr className="border-border border-t bg-muted/20">
				<td
					className="px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide sm:px-5 lg:px-6"
					colSpan={colSpan}
				>
					Product features
				</td>
			</tr>
			{features.map((featureId) => {
				const meta = FEATURE_METADATA[featureId];
				return (
					<tr
						className="border-border border-t hover:bg-card/10"
						key={featureId}
					>
						<th
							className="px-4 py-3 text-left font-normal text-muted-foreground text-sm sm:px-5 lg:px-6"
							scope="row"
							title={meta.description}
						>
							{meta.name}
						</th>
						{plans.map((p) => (
							<td
								className={planTdClassName(p.id)}
								key={`${featureId}-${p.id}`}
							>
								<GatedLimitCell featureId={featureId} tablePlanId={p.id} />
							</td>
						))}
					</tr>
				);
			})}
		</>
	);
}
