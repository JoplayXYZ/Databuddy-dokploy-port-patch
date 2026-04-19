import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ds/spinner";

const button = cva(
	[
		"inline-flex items-center justify-center gap-1.5",
		"select-none whitespace-nowrap font-medium",
		"rounded-md",
		"transition-all duration-(--duration-quick) ease-(--ease-smooth)",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
		"active:scale-[0.98]",
		"disabled:pointer-events-none disabled:opacity-50",
	],
	{
		variants: {
			variant: {
				primary:
					"bg-primary text-primary-foreground shadow-xs hover:brightness-[1.15] active:brightness-[0.9] dark:active:brightness-[0.75] dark:hover:brightness-[0.85]",
				secondary:
					"bg-secondary text-foreground hover:bg-interactive-hover active:bg-interactive-active",
				ghost:
					"bg-transparent text-muted-foreground hover:bg-interactive-hover hover:text-foreground active:bg-interactive-active active:text-foreground",
			},
			tone: {
				neutral: "",
				danger: "",
			},
			size: {
				sm: "h-6 px-2 text-xs",
				md: "h-8 px-3 text-sm",
				lg: "h-9 px-4 text-sm",
			},
		},
		compoundVariants: [
			{
				variant: "primary",
				tone: "danger",
				class:
					"bg-destructive text-destructive-foreground hover:brightness-[1.15]",
			},
			{
				variant: "secondary",
				tone: "danger",
				class: "bg-destructive/10 text-destructive hover:bg-destructive/15",
			},
			{
				variant: "ghost",
				tone: "danger",
				class:
					"text-destructive hover:bg-destructive/10 hover:text-destructive",
			},
		],
		defaultVariants: {
			variant: "primary",
			tone: "neutral",
			size: "md",
		},
	}
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof button> & {
		loading?: boolean;
	};

export function Button({
	className,
	variant,
	tone,
	size,
	type = "button",
	loading,
	disabled,
	children,
	...rest
}: ButtonProps) {
	return (
		<button
			className={cn(button({ variant, tone, size }), className)}
			disabled={disabled || loading}
			type={type}
			{...rest}
		>
			{loading ? (
				<>
					<Spinner size="sm" />
					{children}
				</>
			) : (
				children
			)}
		</button>
	);
}
