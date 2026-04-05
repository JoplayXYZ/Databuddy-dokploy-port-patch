"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWebsitesLight } from "@/hooks/use-websites";
import { OnboardingStepIndicator } from "./_components/onboarding-step-indicator";
import { StepCreateWebsite } from "./_components/step-create-website";
import { StepExplore } from "./_components/step-explore";
import { StepInstallTracking } from "./_components/step-install-tracking";
import { StepInviteTeam } from "./_components/step-invite-team";

const STEPS = [
	{ id: "website", title: "Add Website" },
	{ id: "tracking", title: "Install Tracking" },
	{ id: "team", title: "Invite Team" },
	{ id: "explore", title: "Explore" },
] as const;

export default function OnboardingPage() {
	const router = useRouter();
	const { websites } = useWebsitesLight();

	const [currentStep, setCurrentStep] = useState(0);
	const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
	const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);

	// Derive initial completed state from existing data
	const hasWebsite = websites && websites.length > 0;
	const websiteId = createdWebsiteId ?? websites?.[0]?.id ?? "";

	useEffect(() => {
		if (hasWebsite && !completedSteps.has("website")) {
			setCompletedSteps((prev) => new Set([...prev, "website"]));
			// Auto-advance past step 1 if they already have a website
			if (currentStep === 0) {
				setCurrentStep(1);
			}
		}
	}, [hasWebsite, completedSteps, currentStep]);

	const markComplete = useCallback((stepId: string) => {
		setCompletedSteps((prev) => new Set([...prev, stepId]));
	}, []);

	const goNext = useCallback(() => {
		setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
	}, []);

	const goBack = useCallback(() => {
		setCurrentStep((prev) => Math.max(prev - 1, 0));
	}, []);

	const handleWebsiteCreated = useCallback(
		(id: string) => {
			setCreatedWebsiteId(id);
			markComplete("website");
			goNext();
		},
		[markComplete, goNext]
	);

	const handleTrackingComplete = useCallback(() => {
		markComplete("tracking");
		goNext();
	}, [markComplete, goNext]);

	const handleTeamComplete = useCallback(() => {
		markComplete("team");
		goNext();
	}, [markComplete, goNext]);

	const handleExploreComplete = useCallback(() => {
		markComplete("explore");
		const pendingPlan = localStorage.getItem("pendingPlanSelection");
		if (pendingPlan) {
			localStorage.removeItem("pendingPlanSelection");
			router.replace(`/billing?tab=plans&plan=${pendingPlan}`);
		} else {
			router.replace(`/websites/${websiteId}`);
		}
	}, [markComplete, router, websiteId]);

	const canContinue = useMemo(() => {
		const step = STEPS[currentStep];
		switch (step.id) {
			case "website":
				return completedSteps.has("website");
			case "tracking":
				// Always continuable — user can verify later
				return true;
			case "team":
				return true;
			case "explore":
				return true;
			default:
				return false;
		}
	}, [currentStep, completedSteps]);

	const handleContinue = useCallback(() => {
		const step = STEPS[currentStep];
		if (step.id === "explore") {
			handleExploreComplete();
			return;
		}
		if (step.id === "team") {
			handleTeamComplete();
			return;
		}
		if (step.id === "tracking") {
			// Allow continuing even without verification
			if (!completedSteps.has("tracking")) {
				markComplete("tracking");
			}
			goNext();
			return;
		}
		goNext();
	}, [
		currentStep,
		completedSteps,
		goNext,
		markComplete,
		handleExploreComplete,
		handleTeamComplete,
	]);

	const renderStep = () => {
		switch (STEPS[currentStep].id) {
			case "website":
				return <StepCreateWebsite onComplete={handleWebsiteCreated} />;
			case "tracking":
				return (
					<StepInstallTracking
						onComplete={handleTrackingComplete}
						websiteId={websiteId}
					/>
				);
			case "team":
				return <StepInviteTeam />;
			case "explore":
				return (
					<StepExplore
						onComplete={handleExploreComplete}
						websiteId={websiteId}
					/>
				);
			default:
				return null;
		}
	};

	const isFirstStep = currentStep === 0;
	const showBottomNav = STEPS[currentStep].id !== "explore";

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:px-6">
				<OnboardingStepIndicator
					completedSteps={completedSteps}
					currentStep={currentStep}
					steps={STEPS.map((s) => ({ id: s.id, title: s.title }))}
				/>
				<Button
					className="text-muted-foreground text-xs"
					onClick={() => router.push("/websites")}
					size="sm"
					variant="ghost"
				>
					Skip onboarding
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
				<div className="mx-auto max-w-xl">{renderStep()}</div>
			</div>

			{/* Bottom nav */}
			{showBottomNav && (
				<div className="flex h-12 shrink-0 items-center justify-between border-t px-4 sm:px-6">
					<Button
						className={isFirstStep ? "invisible" : ""}
						disabled={isFirstStep}
						onClick={goBack}
						variant="ghost"
					>
						<ArrowLeftIcon className="mr-1 size-4" weight="bold" />
						Back
					</Button>
					<Button disabled={!canContinue} onClick={handleContinue}>
						{STEPS[currentStep].id === "tracking" &&
						!completedSteps.has("tracking")
							? "Skip for now"
							: "Continue"}
						<ArrowRightIcon className="ml-1 size-4" weight="bold" />
					</Button>
				</div>
			)}
		</div>
	);
}
