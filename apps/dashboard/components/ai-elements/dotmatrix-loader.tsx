"use client";

import { useId, type ComponentType } from "react";
import { DotmCircular1 } from "@/components/ui/dotm-circular-1";
import { DotmCircular2 } from "@/components/ui/dotm-circular-2";
import { DotmCircular3 } from "@/components/ui/dotm-circular-3";
import { DotmCircular4 } from "@/components/ui/dotm-circular-4";
import { DotmCircular5 } from "@/components/ui/dotm-circular-5";
import { DotmCircular6 } from "@/components/ui/dotm-circular-6";
import { DotmCircular7 } from "@/components/ui/dotm-circular-7";
import { DotmCircular8 } from "@/components/ui/dotm-circular-8";
import { DotmCircular9 } from "@/components/ui/dotm-circular-9";
import { DotmCircular10 } from "@/components/ui/dotm-circular-10";
import { DotmCircular11 } from "@/components/ui/dotm-circular-11";
import { DotmCircular12 } from "@/components/ui/dotm-circular-12";
import { DotmCircular13 } from "@/components/ui/dotm-circular-13";
import { DotmCircular14 } from "@/components/ui/dotm-circular-14";
import { DotmCircular15 } from "@/components/ui/dotm-circular-15";
import { DotmCircular16 } from "@/components/ui/dotm-circular-16";
import { DotmCircular17 } from "@/components/ui/dotm-circular-17";
import { DotmCircular18 } from "@/components/ui/dotm-circular-18";
import { DotmCircular19 } from "@/components/ui/dotm-circular-19";
import { DotmCircular20 } from "@/components/ui/dotm-circular-20";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import { DotmSquare2 } from "@/components/ui/dotm-square-2";
import { DotmSquare3 } from "@/components/ui/dotm-square-3";
import { DotmSquare4 } from "@/components/ui/dotm-square-4";
import { DotmSquare5 } from "@/components/ui/dotm-square-5";
import { DotmSquare6 } from "@/components/ui/dotm-square-6";
import { DotmSquare7 } from "@/components/ui/dotm-square-7";
import { DotmSquare8 } from "@/components/ui/dotm-square-8";
import { DotmSquare9 } from "@/components/ui/dotm-square-9";
import { DotmSquare10 } from "@/components/ui/dotm-square-10";
import { DotmSquare11 } from "@/components/ui/dotm-square-11";
import { DotmSquare12 } from "@/components/ui/dotm-square-12";
import { DotmSquare13 } from "@/components/ui/dotm-square-13";
import { DotmSquare14 } from "@/components/ui/dotm-square-14";
import { DotmSquare15 } from "@/components/ui/dotm-square-15";
import { DotmSquare16 } from "@/components/ui/dotm-square-16";
import { DotmSquare17 } from "@/components/ui/dotm-square-17";
import { DotmSquare18 } from "@/components/ui/dotm-square-18";
import { DotmSquare19 } from "@/components/ui/dotm-square-19";
import { DotmSquare20 } from "@/components/ui/dotm-square-20";
import { DotmTriangle1 } from "@/components/ui/dotm-triangle-1";
import { DotmTriangle2 } from "@/components/ui/dotm-triangle-2";
import { DotmTriangle3 } from "@/components/ui/dotm-triangle-3";
import { DotmTriangle4 } from "@/components/ui/dotm-triangle-4";
import { DotmTriangle5 } from "@/components/ui/dotm-triangle-5";
import { DotmTriangle6 } from "@/components/ui/dotm-triangle-6";
import { DotmTriangle7 } from "@/components/ui/dotm-triangle-7";
import { DotmTriangle8 } from "@/components/ui/dotm-triangle-8";
import { DotmTriangle9 } from "@/components/ui/dotm-triangle-9";
import { DotmTriangle10 } from "@/components/ui/dotm-triangle-10";
import { DotmTriangle11 } from "@/components/ui/dotm-triangle-11";
import { DotmTriangle12 } from "@/components/ui/dotm-triangle-12";
import { DotmTriangle13 } from "@/components/ui/dotm-triangle-13";
import { DotmTriangle14 } from "@/components/ui/dotm-triangle-14";
import { DotmTriangle15 } from "@/components/ui/dotm-triangle-15";
import { DotmTriangle16 } from "@/components/ui/dotm-triangle-16";
import { DotmTriangle17 } from "@/components/ui/dotm-triangle-17";
import { DotmTriangle18 } from "@/components/ui/dotm-triangle-18";
import { DotmTriangle19 } from "@/components/ui/dotm-triangle-19";
import { DotmTriangle20 } from "@/components/ui/dotm-triangle-20";
import type { DotMatrixCommonProps } from "@/components/ui/dotmatrix-core";
import { cn } from "@/lib/utils";

type DotMatrixComponent = ComponentType<DotMatrixCommonProps>;

export const DOT_MATRIX_LOADER_NAMES = [
	"dotm-square-1",
	"dotm-square-2",
	"dotm-square-3",
	"dotm-square-4",
	"dotm-square-5",
	"dotm-square-6",
	"dotm-square-7",
	"dotm-square-8",
	"dotm-square-9",
	"dotm-square-10",
	"dotm-square-11",
	"dotm-square-12",
	"dotm-square-13",
	"dotm-square-14",
	"dotm-square-15",
	"dotm-square-16",
	"dotm-square-17",
	"dotm-square-18",
	"dotm-square-19",
	"dotm-square-20",
	"dotm-circular-1",
	"dotm-circular-2",
	"dotm-circular-3",
	"dotm-circular-4",
	"dotm-circular-5",
	"dotm-circular-6",
	"dotm-circular-7",
	"dotm-circular-8",
	"dotm-circular-9",
	"dotm-circular-10",
	"dotm-circular-11",
	"dotm-circular-12",
	"dotm-circular-13",
	"dotm-circular-14",
	"dotm-circular-15",
	"dotm-circular-16",
	"dotm-circular-17",
	"dotm-circular-18",
	"dotm-circular-19",
	"dotm-circular-20",
	"dotm-triangle-1",
	"dotm-triangle-2",
	"dotm-triangle-3",
	"dotm-triangle-4",
	"dotm-triangle-5",
	"dotm-triangle-6",
	"dotm-triangle-7",
	"dotm-triangle-8",
	"dotm-triangle-9",
	"dotm-triangle-10",
	"dotm-triangle-11",
	"dotm-triangle-12",
	"dotm-triangle-13",
	"dotm-triangle-14",
	"dotm-triangle-15",
	"dotm-triangle-16",
	"dotm-triangle-17",
	"dotm-triangle-18",
	"dotm-triangle-19",
	"dotm-triangle-20",
] as const;

export type DotMatrixLoaderName = (typeof DOT_MATRIX_LOADER_NAMES)[number];

const DOT_MATRIX_LOADERS: Record<DotMatrixLoaderName, DotMatrixComponent> = {
	"dotm-square-1": DotmSquare1,
	"dotm-square-2": DotmSquare2,
	"dotm-square-3": DotmSquare3,
	"dotm-square-4": DotmSquare4,
	"dotm-square-5": DotmSquare5,
	"dotm-square-6": DotmSquare6,
	"dotm-square-7": DotmSquare7,
	"dotm-square-8": DotmSquare8,
	"dotm-square-9": DotmSquare9,
	"dotm-square-10": DotmSquare10,
	"dotm-square-11": DotmSquare11,
	"dotm-square-12": DotmSquare12,
	"dotm-square-13": DotmSquare13,
	"dotm-square-14": DotmSquare14,
	"dotm-square-15": DotmSquare15,
	"dotm-square-16": DotmSquare16,
	"dotm-square-17": DotmSquare17,
	"dotm-square-18": DotmSquare18,
	"dotm-square-19": DotmSquare19,
	"dotm-square-20": DotmSquare20,
	"dotm-circular-1": DotmCircular1,
	"dotm-circular-2": DotmCircular2,
	"dotm-circular-3": DotmCircular3,
	"dotm-circular-4": DotmCircular4,
	"dotm-circular-5": DotmCircular5,
	"dotm-circular-6": DotmCircular6,
	"dotm-circular-7": DotmCircular7,
	"dotm-circular-8": DotmCircular8,
	"dotm-circular-9": DotmCircular9,
	"dotm-circular-10": DotmCircular10,
	"dotm-circular-11": DotmCircular11,
	"dotm-circular-12": DotmCircular12,
	"dotm-circular-13": DotmCircular13,
	"dotm-circular-14": DotmCircular14,
	"dotm-circular-15": DotmCircular15,
	"dotm-circular-16": DotmCircular16,
	"dotm-circular-17": DotmCircular17,
	"dotm-circular-18": DotmCircular18,
	"dotm-circular-19": DotmCircular19,
	"dotm-circular-20": DotmCircular20,
	"dotm-triangle-1": DotmTriangle1,
	"dotm-triangle-2": DotmTriangle2,
	"dotm-triangle-3": DotmTriangle3,
	"dotm-triangle-4": DotmTriangle4,
	"dotm-triangle-5": DotmTriangle5,
	"dotm-triangle-6": DotmTriangle6,
	"dotm-triangle-7": DotmTriangle7,
	"dotm-triangle-8": DotmTriangle8,
	"dotm-triangle-9": DotmTriangle9,
	"dotm-triangle-10": DotmTriangle10,
	"dotm-triangle-11": DotmTriangle11,
	"dotm-triangle-12": DotmTriangle12,
	"dotm-triangle-13": DotmTriangle13,
	"dotm-triangle-14": DotmTriangle14,
	"dotm-triangle-15": DotmTriangle15,
	"dotm-triangle-16": DotmTriangle16,
	"dotm-triangle-17": DotmTriangle17,
	"dotm-triangle-18": DotmTriangle18,
	"dotm-triangle-19": DotmTriangle19,
	"dotm-triangle-20": DotmTriangle20,
};

function hashLoaderSeed(seed: string): number {
	let hash = 5381;
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 33 + seed.charCodeAt(i)) % 2_147_483_647;
	}
	return hash;
}

function pickLoaderName(seed: string): DotMatrixLoaderName {
	const index = hashLoaderSeed(seed) % DOT_MATRIX_LOADER_NAMES.length;
	return DOT_MATRIX_LOADER_NAMES[index] ?? "dotm-square-3";
}

export function useRandomDotMatrixLoader(): DotMatrixLoaderName {
	return pickLoaderName(useId());
}

export type DotMatrixLoaderProps = Omit<
	DotMatrixCommonProps,
	"ariaLabel" | "className"
> & {
	className?: string;
	decorative?: boolean;
	label?: string;
	loader?: DotMatrixLoaderName;
	seed?: string;
};

export function DotMatrixLoader({
	animated = true,
	className,
	decorative = false,
	dotSize = 3,
	label = "Loading",
	loader,
	seed = label,
	size = 18,
	speed = 1.4,
	...props
}: DotMatrixLoaderProps) {
	const loaderName = loader ?? pickLoaderName(seed);
	const Loader = DOT_MATRIX_LOADERS[loaderName];
	const element = (
		<Loader
			animated={animated}
			ariaLabel={label}
			className={cn("shrink-0 text-current", className)}
			dotSize={dotSize}
			size={size}
			speed={speed}
			{...props}
		/>
	);

	if (decorative) {
		return <span aria-hidden="true">{element}</span>;
	}

	return element;
}
