"use client";

import type React from "react";
import { cn } from "@/lib/utils";
import { FaviconImage } from "../analytics/favicon-image";
import { TruncatedText } from "../ui/truncated-text";

export interface ReferrerSourceCellData {
	domain?: string;
	id?: string;
	name?: string;
	referrer?: string;
	referrer_type?: string;
}

type ReferrerSourceCellProps = ReferrerSourceCellData & {
	className?: string;
};

export const ReferrerSourceCell: React.FC<ReferrerSourceCellProps> = ({
	id,
	name,
	referrer,
	domain,
	referrer_type,
	className,
}) => {
	const displayName = name || referrer || "Direct";
	const textClassName = className
		? `${className} font-medium text-[15px]`
		: "font-medium text-[15px]";
	const isAI = referrer_type === "ai";

	if (displayName === "Direct" || !domain) {
		return (
			<TruncatedText
				className={cn("truncate", textClassName)}
				id={id}
				text={displayName}
			/>
		);
	}

	return (
		<a
			className={cn(
				"flex min-w-0 cursor-pointer items-center gap-2 hover:text-foreground hover:underline",
				className
			)}
			href={`https://${domain.trim()}`}
			id={id}
			onClick={(e) => {
				e.stopPropagation();
			}}
			rel="noopener noreferrer nofollow"
			target="_blank"
		>
			<FaviconImage
				altText={`${displayName} favicon`}
				className="shrink-0 rounded-sm"
				domain={domain}
				size={18}
			/>
			<TruncatedText
				className={cn("min-w-0 truncate", textClassName)}
				text={displayName}
			/>
			{isAI ? (
				<span className="shrink-0 rounded bg-purple-500/10 px-1.5 py-0.5 font-medium text-[10px] text-purple-500 leading-none">
					AI
				</span>
			) : null}
		</a>
	);
};
