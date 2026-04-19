import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { IconAiLoadingFillDuo18 } from "nucleo-ui-fill-duo-18";
import type { HTMLAttributes } from "react";

const wrapper = cva("relative inline-flex items-center justify-center", {
	variants: {
		size: {
			sm: "size-3.5",
			md: "size-5",
			lg: "size-8",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

type SpinnerProps = HTMLAttributes<HTMLDivElement> &
	VariantProps<typeof wrapper>;

export function Spinner({ className, size, ...rest }: SpinnerProps) {
	return (
		<div
			aria-label="Loading"
			className={cn(wrapper({ size }), className)}
			role="status"
			{...rest}
	>
			<IconAiLoadingFillDuo18
				className="size-full animate-spin"
				style={{ animationDuration: "0.75s" }}
			/>
		</div>
	);
}
