import type { SVGProps } from "react";
import { cloneElement } from "react";
import { cn } from "@/lib/utils";

export const NoticeBanner = ({
	title,
	children,
	icon,
	className,
	description,
}: {
	title?: string;
	children?: React.ReactNode;
	icon: React.ReactElement<
		SVGProps<SVGSVGElement> & { size?: number | string; weight?: string }
	>;
	className?: string;
	description?: string;
}) => (
	<div
		className={cn(
			"notice-banner-angled-rectangle-gradient flex flex-1 items-center gap-2 rounded border border-border bg-accent px-3 py-2 font-medium text-accent-foreground text-sm",
			className
		)}
	>
		<div className="flex w-full flex-wrap items-center justify-between gap-5">
			{description || title || icon ? (
				<div className="flex flex-1 items-center gap-2">
					{icon
						? cloneElement(icon, {
								...icon.props,
								className: cn(
									"shrink-0 text-accent-foreground",
									icon.props.className
								),
								"aria-hidden": true,
								weight: "fill",
								size: 20,
							})
						: null}
					<div className="flex flex-1 flex-col gap-0.5">
						{title ? (
							<h3 className="text-balance font-medium text-accent-foreground text-sm">
								{title}
							</h3>
						) : null}
						{description ? (
							<p className="text-pretty text-accent-foreground/90 text-xs">
								{description}
							</p>
						) : null}
					</div>
				</div>
			) : null}
			{children ? children : null}
		</div>
	</div>
);
