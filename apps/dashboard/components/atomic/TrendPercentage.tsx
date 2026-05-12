"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface TrendPercentageProps {
	className?: string;
	digits?: number;
	id?: string;
	invertColor?: boolean;
	value: number;
}

const formatPercentage = (value: number, digits = 1): string => {
	const normalized = Object.is(value, -0) ? 0 : value;
	const rounded = Number(normalized.toFixed(digits));
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded.toFixed(digits)}%`;
};

export const TrendPercentage: React.FC<TrendPercentageProps> = ({
	id,
	value,
	invertColor = false,
	className,
	digits = 1,
}) => {
	let colorClass = "text-muted-foreground";

	if (Number.isNaN(value)) {
		return (
			<span className={cn("text-muted-foreground", className)} id={id}>
				--%
			</span>
		);
	}

	if (value > 0) {
		colorClass = invertColor ? "text-destructive" : "text-success";
	}
	if (value < 0) {
		colorClass = invertColor ? "text-success" : "text-destructive";
	}

	return (
		<span className={cn("font-medium", colorClass, className)} id={id}>
			{formatPercentage(value, digits)}
		</span>
	);
};

export default TrendPercentage;
