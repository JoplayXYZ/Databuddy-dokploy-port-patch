"use client";

import { Button } from "@/components/ds/button";
import { Tooltip } from "@databuddy/ui";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "@databuddy/ui/icons";

type CopyButtonProps = Omit<
	React.ComponentProps<typeof Button>,
	"onClick" | "children"
> & {
	value: string;
	label?: string;
	copiedLabel?: string;
	onCopy?: () => void;
};

export function CopyButton({
	value,
	label,
	copiedLabel = "Copied",
	onCopy,
	variant = "ghost",
	size = "sm",
	className,
	...rest
}: CopyButtonProps) {
	const { isCopied, copyToClipboard } = useCopyToClipboard({ onCopy });

	const Icon = isCopied ? CheckIcon : CopyIcon;

	if (label) {
		return (
			<Button
				className={className}
				onClick={() => copyToClipboard(value)}
				size={size}
				variant={variant}
				{...rest}
			>
				<Icon className="size-3.5" />
				{isCopied ? copiedLabel : label}
			</Button>
		);
	}

	return (
		<Tooltip content={isCopied ? copiedLabel : "Copy"}>
			<Button
				aria-label="Copy to clipboard"
				className={cn("aspect-square px-0", className)}
				onClick={() => copyToClipboard(value)}
				size={size}
				variant={variant}
				{...rest}
			>
				<Icon className="size-3.5" />
			</Button>
		</Tooltip>
	);
}
