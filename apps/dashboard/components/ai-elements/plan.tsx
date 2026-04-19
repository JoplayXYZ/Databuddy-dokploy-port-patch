"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ds/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Shimmer } from "./shimmer";

interface PlanContextValue {
	isStreaming: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
	const context = useContext(PlanContext);
	if (!context) {
		throw new Error("Plan components must be used within Plan");
	}
	return context;
};

export type PlanProps = ComponentProps<typeof Collapsible> & {
	isStreaming?: boolean;
};

export const Plan = ({
	className,
	isStreaming = false,
	children,
	...props
}: PlanProps) => (
	<PlanContext.Provider value={{ isStreaming }}>
		<Collapsible asChild data-slot="plan" {...props}>
			<Card className={cn("shadow-none", className)}>{children}</Card>
		</Collapsible>
	</PlanContext.Provider>
);

export type PlanHeaderProps = ComponentProps<typeof Card.Header>;

export const PlanHeader = ({ className, ...props }: PlanHeaderProps) => (
	<Card.Header
		className={cn("flex items-start justify-between", className)}
		data-slot="plan-header"
		{...props}
	/>
);

export type PlanTitleProps = Omit<
	ComponentProps<typeof Card.Title>,
	"children"
> & {
	children: string;
};

export const PlanTitle = ({ children, ...props }: PlanTitleProps) => {
	const { isStreaming } = usePlan();

	return (
		<Card.Title data-slot="plan-title" {...props}>
			{isStreaming ? <Shimmer>{children}</Shimmer> : children}
		</Card.Title>
	);
};

export type PlanDescriptionProps = Omit<
	ComponentProps<typeof Card.Description>,
	"children"
> & {
	children: string;
};

export const PlanDescription = ({
	className,
	children,
	...props
}: PlanDescriptionProps) => {
	const { isStreaming } = usePlan();

	return (
		<Card.Description
			className={cn("text-balance", className)}
			data-slot="plan-description"
			{...props}
		>
			{isStreaming ? <Shimmer>{children}</Shimmer> : children}
		</Card.Description>
	);
};

export type PlanActionProps = ComponentProps<typeof Card.Action>;

export const PlanAction = (props: PlanActionProps) => (
	<Card.Action data-slot="plan-action" {...props} />
);

export type PlanContentProps = ComponentProps<typeof Card.Content>;

export const PlanContent = (props: PlanContentProps) => (
	<CollapsibleContent asChild>
		<Card.Content data-slot="plan-content" {...props} />
	</CollapsibleContent>
);

export type PlanFooterProps = ComponentProps<"div">;

export const PlanFooter = (props: PlanFooterProps) => (
	<Card.Footer data-slot="plan-footer" {...props} />
);

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const PlanTrigger = ({ className, ...props }: PlanTriggerProps) => (
	<CollapsibleTrigger asChild>
		<Button
			className={cn("size-8", className)}
			data-slot="plan-trigger"
			size="icon"
			variant="ghost"
			{...props}
		>
			<ChevronsUpDownIcon className="size-4" />
			<span className="sr-only">Toggle plan</span>
		</Button>
	</CollapsibleTrigger>
);
