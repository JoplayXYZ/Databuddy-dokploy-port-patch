"use client";

import { Badge } from "@/components/ds/badge";
import { Text } from "@/components/ds/text";
import type { ApiKeyListItem } from "@/components/organizations/api-key-types";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

interface ApiKeyRowProps {
	apiKey: ApiKeyListItem;
	onSelect: () => void;
}

export function ApiKeyRow({ apiKey, onSelect }: ApiKeyRowProps) {
	const isActive = apiKey.enabled && !apiKey.revokedAt;
	const isExpired =
		apiKey.expiresAt && dayjs(apiKey.expiresAt).isBefore(dayjs());
	const isRevoked = !!apiKey.revokedAt;

	const scopeCount = apiKey.scopes?.length ?? 0;

	return (
		<button
			className={cn(
				"group flex w-full items-center gap-3 px-5 py-3 text-left",
				"transition-colors duration-(--duration-quick) ease-(--ease-smooth)",
				"hover:bg-interactive-hover"
			)}
			onClick={onSelect}
			type="button"
		>
			<div
				className={cn(
					"size-2 shrink-0 rounded-full",
					isActive ? "bg-success" : "bg-muted-foreground/30"
				)}
			/>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<Text
						className={cn(
							"truncate",
							!isActive &&
								"text-muted-foreground line-through decoration-muted-foreground/40"
						)}
						variant="label"
					>
						{apiKey.name}
					</Text>
					{isExpired && (
						<Badge size="sm" variant="warning">
							Expired
						</Badge>
					)}
					{isRevoked && (
						<Badge size="sm" variant="destructive">
							Revoked
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2">
					<code className="font-mono text-[11px] text-muted-foreground">
						{apiKey.start}••••
					</code>
					<span className="text-border">·</span>
					<Text as="span" tone="muted" variant="caption">
						{dayjs(apiKey.createdAt).fromNow()}
					</Text>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{scopeCount > 0 && (
					<Badge size="sm" variant="muted">
						{scopeCount} {scopeCount === 1 ? "scope" : "scopes"}
					</Badge>
				)}
				{apiKey.expiresAt && !isExpired && (
					<Text
						as="span"
						className="hidden sm:block"
						tone="muted"
						variant="caption"
					>
						expires {dayjs(apiKey.expiresAt).fromNow()}
					</Text>
				)}
			</div>

			<CaretRightIcon
				className={cn(
					"shrink-0 text-muted-foreground/30 transition-all",
					"group-hover:translate-x-0.5 group-hover:text-muted-foreground"
				)}
				size={12}
				weight="bold"
			/>
		</button>
	);
}
