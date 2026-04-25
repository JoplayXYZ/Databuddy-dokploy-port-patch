"use client";

import {
	FEATURE_METADATA,
	type GatedFeatureId,
} from "@databuddy/shared/types/features";
import { authClient } from "@databuddy/auth/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ds/avatar";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	LockSimpleIcon,
} from "@/components/icons/nucleo";
import { Skeleton } from "@/components/ds/skeleton";
import { Tooltip } from "@/components/ds/tooltip";
import { useBillingContext } from "@/components/providers/billing-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MobileSidebar } from "./mobile-sidebar";
import { isNavItemActive } from "./navigation/nav-item-active";
import type { NavigationGroup, NavigationItem } from "./navigation/types";
import { OrganizationSelector } from "./organization-selector";
import { getInitials, ProfileDropdownContent } from "./profile-button-client";
import { SidebarPanel, useSidebarLayout } from "./sidebar-layout";
import { useSidebarNavigation } from "./sidebar-navigation-provider";
import { ThemeToggle } from "./theme-toggle";

const P = {
	outer: "px-2",
	outerCollapsed: "px-1.5",
	item: "px-2.5",
	icon: "size-[18px] shrink-0",
} as const;

function SidebarNavItem({
	item,
	pathname,
	currentWebsiteId,
	isDemo,
	isLocked,
	lockedPlanName,
	collapsed,
}: {
	collapsed: boolean;
	currentWebsiteId?: string | null;
	isDemo: boolean;
	isLocked: boolean;
	item: NavigationItem;
	lockedPlanName: string | null;
	pathname: string;
}) {
	const active = isNavItemActive(item, pathname, currentWebsiteId);

	const fullPath = useMemo(() => {
		if (item.rootLevel) return item.href;
		if (isDemo) {
			return item.href === ""
				? `/demo/${currentWebsiteId}`
				: `/demo/${currentWebsiteId}${item.href}`;
		}
		return `/websites/${currentWebsiteId}${item.href}`;
	}, [item.href, item.rootLevel, currentWebsiteId, isDemo]);

	if (item.production === false && process.env.NODE_ENV === "production") {
		return null;
	}

	const Icon = item.icon;
	const base = cn(
		"flex min-w-0 items-center rounded text-sm",
		collapsed ? "size-9 justify-center" : "h-9 gap-3",
		collapsed ? "" : P.item
	);

	if (isLocked) {
		const el = (
			<div
				aria-disabled
				className={cn(base, "cursor-not-allowed text-sidebar-foreground/30")}
				title={lockedPlanName ? `Requires ${lockedPlanName} plan` : undefined}
			>
				<Icon aria-hidden className={P.icon} />
				{!collapsed && (
					<>
						<span className="min-w-0 flex-1 truncate">{item.name}</span>
						<LockSimpleIcon aria-hidden className="size-3.5 shrink-0" />
						{lockedPlanName && (
							<span className="rounded bg-sidebar-accent px-1.5 py-0.5 font-semibold text-[10px] text-sidebar-foreground/40 uppercase">
								{lockedPlanName}
							</span>
						)}
					</>
				)}
			</div>
		);
		return collapsed ? (
			<Tooltip content={`${item.name} (${lockedPlanName})`} side="right">{el}</Tooltip>
		) : el;
	}

	if (item.disabled) {
		const el = (
			<div aria-disabled className={cn(base, "cursor-not-allowed opacity-25")}>
				<Icon aria-hidden className={P.icon} />
				{!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
			</div>
		);
		return collapsed ? (
			<Tooltip content={item.name} side="right">{el}</Tooltip>
		) : el;
	}

	const LinkComponent = item.external ? "a" : Link;
	const linkProps = item.external
		? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
		: { href: fullPath, prefetch: true as const };

	const el = (
		<LinkComponent
			{...linkProps}
			aria-current={active ? "page" : undefined}
			className={cn(
				base,
				"group",
				active
					? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
					: "text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
			)}
		>
			<Icon aria-hidden className={P.icon} />
			{!collapsed && (
				<>
					<span className="min-w-0 flex-1 truncate">{item.name}</span>
					{(item.alpha || item.tag || item.badge || item.external) && (
						<div className="flex shrink-0 items-center gap-1.5">
							{(item.alpha || item.tag) && (
								<span className="font-semibold text-[10px] text-sidebar-foreground/30 uppercase">
									{item.alpha ? "ALPHA" : item.tag}
								</span>
							)}
							{item.badge && (
								<span
									className={cn(
										"rounded px-1.5 py-0.5 font-semibold text-[10px]",
										item.badge.variant === "orange"
											? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
											: item.badge.variant === "red"
												? "bg-destructive/10 text-destructive"
												: "bg-accent text-accent-foreground"
									)}
								>
									{item.badge.text}
								</span>
							)}
							{item.external && (
								<ArrowSquareOutIcon
									aria-hidden
									className="size-3.5 shrink-0 text-sidebar-foreground/25 opacity-0 group-hover:opacity-100"
								/>
							)}
						</div>
					)}
				</>
			)}
		</LinkComponent>
	);

	return collapsed ? (
		<Tooltip content={item.name} side="right">{el}</Tooltip>
	) : el;
}

function NavGroupLabel({ group, collapsed, isFirst }: { collapsed: boolean; group: NavigationGroup; isFirst: boolean }) {
	if (collapsed) {
		return isFirst ? null : <div className="mx-auto my-1.5 h-px w-5 bg-sidebar-border/30" />;
	}
	if (!(group.label || group.back)) return null;

	const spacing = isFirst ? "pt-1 pb-1.5" : "pt-4 pb-1.5";

	if (group.back) {
		return (
			<div className={cn("flex items-center gap-1.5 px-3", spacing)}>
				<Link
					className="flex items-center gap-1 font-semibold text-[11px] text-sidebar-foreground/35 uppercase tracking-wider hover:text-sidebar-foreground/60"
					href={group.back.href}
				>
					<ArrowLeftIcon className="size-3 shrink-0" />
					{group.back.label}
				</Link>
				<span className="text-sidebar-foreground/15">/</span>
				<span className="font-semibold text-[11px] text-sidebar-foreground/35 uppercase tracking-wider">
					{group.label}
				</span>
			</div>
		);
	}

	return (
		<div className={cn("px-3 font-semibold text-[11px] text-sidebar-foreground/35 uppercase tracking-wider", spacing)}>
			{group.label}
		</div>
	);
}

function NavGroup({
	group,
	pathname,
	currentWebsiteId,
	isDemo,
	isFeatureEnabled,
	isBillingLoading,
	collapsed,
	isFirst,
}: {
	collapsed: boolean;
	currentWebsiteId?: string | null;
	group: NavigationGroup;
	isBillingLoading: boolean;
	isDemo: boolean;
	isFeatureEnabled: (feature: GatedFeatureId) => boolean;
	isFirst: boolean;
	pathname: string;
}) {
	const visibleItems = group.items.filter((item) => {
		if (item.production === false && process.env.NODE_ENV === "production") return false;
		if (item.hideFromDemo && isDemo) return false;
		if (item.showOnlyOnDemo && !isDemo) return false;
		return true;
	});

	if (visibleItems.length === 0) return null;

	return (
		<div>
			<NavGroupLabel collapsed={collapsed} group={group} isFirst={isFirst} />
			<div className={cn("flex flex-col gap-0.5", collapsed ? cn("items-center", P.outerCollapsed) : P.outer)}>
				{visibleItems.map((item) => {
					const locked =
						!isBillingLoading &&
						item.gatedFeature != null &&
						!isFeatureEnabled(item.gatedFeature);

					return (
						<SidebarNavItem
							collapsed={collapsed}
							currentWebsiteId={currentWebsiteId}
							isDemo={isDemo}
							isLocked={locked}
							item={item}
							key={`${item.name}::${item.href}`}
							lockedPlanName={
								locked && item.gatedFeature
									? (FEATURE_METADATA[item.gatedFeature]?.minPlan?.toUpperCase() ?? null)
									: null
							}
							pathname={pathname}
						/>
					);
				})}
			</div>
		</div>
	);
}

function SidebarUserFooter({ collapsed }: { collapsed: boolean }) {
	const { data: session, isPending } = authClient.useSession();
	const user = session?.user ?? null;
	const [hasMounted, setHasMounted] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	if (!hasMounted || isPending) {
		return (
			<div className={cn(collapsed ? P.outerCollapsed : P.outer, "py-2")}>
				<div
					className={cn(
						"flex items-center gap-2.5 rounded bg-sidebar-accent/50",
						collapsed ? "size-9 justify-center" : "h-9 px-2.5"
					)}
				>
					<Skeleton className="size-6 shrink-0 rounded-full" />
					{!collapsed && <Skeleton className="h-3 w-20 rounded" />}
				</div>
			</div>
		);
	}

	if (!user) return null;

	if (collapsed) {
		return (
			<div className={cn(P.outerCollapsed, "py-2")}>
				<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
					<Tooltip content={user.name || user.email || "Account"} side="right">
						<DropdownMenu.Trigger
							className="flex size-9 items-center justify-center rounded bg-sidebar-accent/50 hover:bg-sidebar-accent"
							render={<button type="button" />}
						>
							<Avatar
								alt={user.name || "User"}
								className="size-6 shrink-0"
								fallback={getInitials(user.name, user.email)}
								src={user.image || undefined}
							/>
						</DropdownMenu.Trigger>
					</Tooltip>
					<ProfileDropdownContent isOpen={isOpen} onClose={() => setIsOpen(false)} user={user} />
				</DropdownMenu>
			</div>
		);
	}

	return (
		<div className={cn(P.outer, "py-2")}>
			<div className="flex items-center gap-2 rounded bg-sidebar-accent/50 px-2.5 py-2">
				<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
					<DropdownMenu.Trigger
						className={cn(
							"flex min-w-0 flex-1 items-center gap-2.5 rounded text-left hover:opacity-80",
							isOpen && "opacity-80"
						)}
						render={<button type="button" />}
					>
						<Avatar
							alt={user.name || "User"}
							className="size-7 shrink-0"
							fallback={getInitials(user.name, user.email)}
							src={user.image || undefined}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-semibold text-sidebar-foreground text-sm">
								{user.name || "User"}
							</p>
							<p className="truncate text-sidebar-foreground/40 text-xs">
								{user.email}
							</p>
						</div>
					</DropdownMenu.Trigger>
					<ProfileDropdownContent isOpen={isOpen} onClose={() => setIsOpen(false)} user={user} />
				</DropdownMenu>
				<ThemeToggle />
			</div>
		</div>
	);
}

export function Sidebar() {
	const { navigation, currentWebsiteId, pathname, isDemo, navContext, transitionDirection } =
		useSidebarNavigation();
	const { isFeatureEnabled, isLoading: isBillingLoading } = useBillingContext();
	const { open } = useSidebarLayout();

	const collapsed = !open;
	const topGroups = navigation.filter((g) => !g.pinToBottom);
	const bottomGroups = navigation.filter((g) => g.pinToBottom);

	const slideClass =
		transitionDirection === "left"
			? "animate-in fade-in slide-in-from-right-2 duration-150"
			: transitionDirection === "right"
				? "animate-in fade-in slide-in-from-left-2 duration-150"
				: undefined;

	const groupProps = {
		collapsed,
		currentWebsiteId,
		isBillingLoading,
		isDemo,
		isFeatureEnabled,
		pathname,
	};

	return (
		<>
			<SidebarPanel>
				<OrganizationSelector collapsed={collapsed} />

				<ScrollArea className="flex-1" key={navContext}>
					<div className={cn("flex flex-col", slideClass)}>
						{topGroups.map((group, i) => (
							<NavGroup group={group} isFirst={i === 0} key={group.label || "__top"} {...groupProps} />
						))}
					</div>
				</ScrollArea>

				{bottomGroups.length > 0 && (
					<div className={cn("flex flex-col py-1", slideClass)}>
						{!collapsed && <div className={cn(P.outer, "pb-1")}><div className="h-px bg-sidebar-border/30" /></div>}
						{bottomGroups.map((group) => (
							<NavGroup group={group} isFirst key={group.label || "__pinned"} {...groupProps} />
						))}
					</div>
				)}

				<SidebarUserFooter collapsed={collapsed} />
			</SidebarPanel>
			<MobileSidebar />
		</>
	);
}
