"use client";

import {
	IconExternalLinkFillDuo18,
	IconFileContentFillDuo18,
} from "nucleo-ui-fill-duo-18";
import type React from "react";
import { formatDomainLink } from "@/app/(main)/websites/[id]/_components/utils/analytics-helpers";
import { cn } from "@/lib/utils";

export interface PageLinkCellData {
	id?: string;
	path: string;
	websiteDomain?: string;
}

type PageLinkCellProps = PageLinkCellData & {
	className?: string;
	iconClassName?: string;
	textClassName?: string;
	maxLength?: number;
};

export const PageLinkCell: React.FC<PageLinkCellProps> = ({
	id,
	path,
	websiteDomain,
	className,
	iconClassName = "size-4 text-muted-foreground",
	textClassName = "text-sm",
	maxLength = 35,
}) => {
	if (!path) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)} id={id}>
				(not set)
			</span>
		);
	}

	const { href, display } = formatDomainLink(path, websiteDomain, maxLength);
	const isExternal = href.startsWith("http");

	return (
		<a
			className={cn(
				"group flex items-center gap-1.5 hover:underline",
				className
			)}
			href={href}
			id={id}
			rel={isExternal ? "noopener noreferrer" : undefined}
			target={isExternal ? "_blank" : undefined}
		>
			<IconFileContentFillDuo18
				className={cn("shrink-0", iconClassName)}
			/>
			<span
				className={cn("truncate group-hover:text-primary", textClassName)}
				style={{ maxWidth: `${maxLength + 2}ch` }}
			>
				{display}
			</span>
			{isExternal && (
				<IconExternalLinkFillDuo18
					className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
				/>
			)}
		</a>
	);
};

export default PageLinkCell;
