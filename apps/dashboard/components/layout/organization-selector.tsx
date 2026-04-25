"use client";

import { authClient } from "@databuddy/auth/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ds/avatar";
import { Badge } from "@/components/ds/badge";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Skeleton } from "@/components/ds/skeleton";
import { Tooltip } from "@/components/ds/tooltip";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { useBillingContext } from "@/components/providers/billing-provider";
import {
	AUTH_QUERY_KEYS,
	useOrganizationsContext,
} from "@/components/providers/organizations-provider";
import { cn } from "@/lib/utils";
import {
	CaretDownIcon,
	CheckIcon,
	CreditCardIcon,
	GearIcon,
	PlusIcon,
	SpinnerGapIcon,
} from "@/components/icons/nucleo";

const getDicebearUrl = (seed: string | undefined) =>
	`https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed || "")}`;

const MENU_ITEM_BASE_CLASSES =
	"flex h-9 cursor-pointer items-center gap-2.5 px-4 text-sm text-sidebar-foreground/70 data-highlighted:bg-sidebar-accent/60 data-highlighted:text-sidebar-accent-foreground";
const MENU_ITEM_ACTIVE_CLASSES =
	"bg-sidebar-accent font-medium text-sidebar-accent-foreground";

function filterOrganizations<T extends { name: string; slug?: string | null }>(
	orgs: T[] | undefined,
	query: string
): T[] {
	if (!orgs?.length) {
		return [];
	}
	if (!query) {
		return orgs;
	}
	const q = query.toLowerCase();
	return orgs.filter(
		(org) =>
			org.name.toLowerCase().includes(q) || org.slug?.toLowerCase().includes(q)
	);
}

interface OrganizationSelectorTriggerProps
	extends React.ComponentPropsWithRef<"button"> {
	activeOrganization: {
		id?: string;
		name: string;
		slug?: string | null;
		logo?: string | null;
	} | null;
	isOpen: boolean;
	isSettingActiveOrganization: boolean;
}

function OrganizationSelectorTrigger({
	activeOrganization,
	isOpen,
	isSettingActiveOrganization,
	ref,
	className,
	type = "button",
	...rest
}: OrganizationSelectorTriggerProps) {
	return (
		<button
			className={cn(
				"flex h-12 w-full items-center px-3",
				"hover:bg-sidebar-accent/50",
				isSettingActiveOrganization && "cursor-not-allowed opacity-70",
				isOpen && "bg-sidebar-accent/40",
				className
			)}
			ref={ref}
			type={type}
			{...rest}
		>
			<div className="flex w-full min-w-0 items-center gap-2.5">
				<Avatar
					alt={activeOrganization?.name ?? "Workspace"}
					className="size-7 shrink-0 rounded ring-1 ring-black/10 ring-inset"
					src={getDicebearUrl(
						activeOrganization?.logo || activeOrganization?.id
					)}
				/>
				<span className="min-w-0 flex-1 truncate text-left font-semibold text-sidebar-foreground text-sm">
					{activeOrganization?.name ?? "Select workspace"}
				</span>
				{isSettingActiveOrganization ? (
					<SpinnerGapIcon
						aria-label="Switching workspace"
						className="size-4 shrink-0 animate-spin text-sidebar-foreground/40"
					/>
				) : (
					<CaretDownIcon
						className={cn(
							"size-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-(--duration-quick)",
							isOpen ? "rotate-180" : ""
						)}
					/>
				)}
			</div>
		</button>
	);
}

export function OrganizationSelector({
	collapsed = false,
}: {
	collapsed?: boolean;
}) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { organizations, activeOrganization, isLoading } =
		useOrganizationsContext();
	const { currentPlanId } = useBillingContext();
	const [isOpen, setIsOpen] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [query, setQuery] = useState("");
	const [isSwitching, setIsSwitching] = useState(false);

	const planLabel = currentPlanId
		? currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1)
		: null;

	const navigateTo = (href: string) => {
		setIsOpen(false);
		router.push(href);
	};

	const handleSelectOrganization = async (organizationId: string) => {
		if (organizationId === activeOrganization?.id) {
			return;
		}

		setIsSwitching(true);
		setIsOpen(false);

		const { error } = await authClient.organization.setActive({
			organizationId,
		});

		if (error) {
			toast.error(error.message || "Failed to switch workspace");
			setIsSwitching(false);
			return;
		}

		await queryClient.invalidateQueries({
			queryKey: AUTH_QUERY_KEYS.activeOrganization,
		});
		queryClient.invalidateQueries();

		setIsSwitching(false);
		toast.success("Workspace updated");
	};

	const filteredOrganizations = filterOrganizations(organizations, query);

	if (isLoading) {
		return (
			<div
				className={cn(
					"flex h-12 w-full items-center",
					collapsed ? "justify-center px-1.5" : "px-3 py-3"
				)}
			>
				<Skeleton className="size-7 shrink-0 rounded-full" />
				{!collapsed && (
					<div className="ml-3 flex min-w-0 flex-1 flex-col items-start">
						<Skeleton className="h-4 w-24 rounded" />
						<Skeleton className="mt-1 h-3 w-16 rounded" />
					</div>
				)}
			</div>
		);
	}

	if (collapsed) {
		return (
			<>
				<DropdownMenu
					onOpenChange={(open) => {
						setIsOpen(open);
						if (!open) {
							setQuery("");
						}
					}}
					open={isOpen}
				>
					<Tooltip
						content={activeOrganization?.name ?? "Workspace"}
						side="right"
					>
						<DropdownMenu.Trigger
							className="flex h-12 w-full items-center justify-center hover:opacity-80"
							disabled={isSwitching}
							render={<button type="button" />}
						>
							<Avatar
								alt={activeOrganization?.name ?? "Workspace"}
								className="size-7 shrink-0 rounded ring-1 ring-black/10 ring-inset"
								src={getDicebearUrl(
									activeOrganization?.logo || activeOrganization?.id
								)}
							/>
						</DropdownMenu.Trigger>
					</Tooltip>
					<DropdownMenu.Content
						align="start"
						className="w-72 bg-sidebar p-0"
						side="right"
						sideOffset={4}
					>
						{filteredOrganizations.length > 0 && (
							<div className="flex flex-col">
								{filteredOrganizations.map((org) => (
									<DropdownMenu.Item
										className={cn(
											MENU_ITEM_BASE_CLASSES,
											activeOrganization?.id === org.id &&
												MENU_ITEM_ACTIVE_CLASSES
										)}
										key={org.id}
										onClick={() => handleSelectOrganization(org.id)}
									>
										<Avatar
											alt={org.name}
											className="size-5 shrink-0 rounded ring-1 ring-black/10 ring-inset"
											src={getDicebearUrl(org.logo || org.id)}
										/>
										<span className="min-w-0 flex-1 truncate text-left font-medium text-sm">
											{org.name}
										</span>
										{activeOrganization?.id === org.id && (
											<CheckIcon className="size-4 shrink-0 text-accent-foreground" />
										)}
									</DropdownMenu.Item>
								))}
							</div>
						)}
						<DropdownMenu.Separator className="m-0" />
						<DropdownMenu.Item
							className={MENU_ITEM_BASE_CLASSES}
							onClick={() => navigateTo("/organizations/settings")}
						>
							<GearIcon className="size-5 text-accent-foreground" />
							<span className="font-medium text-sm">Workspace settings</span>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							className={MENU_ITEM_BASE_CLASSES}
							onClick={() => navigateTo("/billing")}
						>
							<CreditCardIcon className="size-5 text-accent-foreground" />
							<span className="font-medium text-sm">Billing</span>
							{planLabel && (
								<Badge className="ml-auto" size="sm">
									{planLabel}
								</Badge>
							)}
						</DropdownMenu.Item>
						<DropdownMenu.Separator className="m-0" />
						<DropdownMenu.Item
							className={MENU_ITEM_BASE_CLASSES}
							onClick={() => {
								setShowCreateDialog(true);
								setIsOpen(false);
							}}
						>
							<PlusIcon className="size-5 text-accent-foreground" />
							<span className="font-medium text-sm">Create Organization</span>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu>
				<CreateOrganizationDialog
					isOpen={showCreateDialog}
					onClose={() => setShowCreateDialog(false)}
				/>
			</>
		);
	}

	return (
		<>
			<DropdownMenu
				onOpenChange={(open) => {
					setIsOpen(open);
					if (!open) {
						setQuery("");
					}
				}}
				open={isOpen}
			>
				<DropdownMenu.Trigger
					className="w-full text-left focus-visible:outline-none"
					disabled={isSwitching}
					render={
						<OrganizationSelectorTrigger
							activeOrganization={activeOrganization}
							isOpen={isOpen}
							isSettingActiveOrganization={isSwitching}
						/>
					}
				/>
				<DropdownMenu.Content
					align="start"
					className="w-72 bg-sidebar p-0"
					sideOffset={0}
				>
					{filteredOrganizations.length > 0 && (
						<div className="flex flex-col">
							{filteredOrganizations.map((org) => (
								<DropdownMenu.Item
									className={cn(
										MENU_ITEM_BASE_CLASSES,
										activeOrganization?.id === org.id &&
											MENU_ITEM_ACTIVE_CLASSES
									)}
									key={org.id}
									onClick={() => handleSelectOrganization(org.id)}
								>
									<Avatar
										alt={org.name}
										className="size-5 shrink-0 rounded ring-1 ring-black/10 ring-inset"
										src={getDicebearUrl(org.logo || org.id)}
									/>
									<span className="min-w-0 flex-1 truncate text-left font-medium text-sm">
										{org.name}
									</span>
									{activeOrganization?.id === org.id && (
										<CheckIcon className="size-4 shrink-0 text-accent-foreground" />
									)}
								</DropdownMenu.Item>
							))}
						</div>
					)}

					<DropdownMenu.Separator className="m-0" />
					<DropdownMenu.Item
						className={MENU_ITEM_BASE_CLASSES}
						onClick={() => navigateTo("/organizations/settings")}
					>
						<GearIcon
							className="size-5 text-accent-foreground"
							weight="duotone"
						/>
						<span className="font-medium text-sm">Workspace settings</span>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						className={MENU_ITEM_BASE_CLASSES}
						onClick={() => navigateTo("/billing")}
					>
						<CreditCardIcon
							className="size-5 text-accent-foreground"
							weight="duotone"
						/>
						<span className="font-medium text-sm">Billing</span>
						{planLabel && (
							<Badge className="ml-auto" size="sm">
								{planLabel}
							</Badge>
						)}
					</DropdownMenu.Item>
					<DropdownMenu.Separator className="m-0" />
					<DropdownMenu.Item
						className={MENU_ITEM_BASE_CLASSES}
						onClick={() => {
							setShowCreateDialog(true);
							setIsOpen(false);
						}}
					>
						<PlusIcon className="size-5 text-accent-foreground" />
						<span className="font-medium text-sm">Create Organization</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<CreateOrganizationDialog
				isOpen={showCreateDialog}
				onClose={() => setShowCreateDialog(false)}
			/>
		</>
	);
}
