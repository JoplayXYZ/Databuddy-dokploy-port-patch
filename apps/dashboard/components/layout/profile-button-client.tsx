"use client";

import { authClient } from "@databuddy/auth/client";
import {
	CaretRightIcon,
	CreditCardIcon,
	GearIcon,
	PlusIcon,
	SignOutIcon,
	SpinnerGapIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ds/avatar";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Tooltip } from "@/components/ds/tooltip";
import { Text } from "@/components/ds/text";

export interface ProfileButtonUser {
	email?: string | null;
	id?: string;
	image?: string | null;
	name?: string | null;
}

interface ProfileButtonClientProps {
	user: ProfileButtonUser | null;
}

interface DeviceSession {
	session: {
		id: string;
		token: string;
		userId: string;
		expiresAt: Date;
		ipAddress: string | null;
		userAgent: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	user: {
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		image: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
}

const PRESERVED_QUERY_KEYS = [["auth", "session"], ["device-sessions"]];

function getInitials(
	name: string | null | undefined,
	email: string | null | undefined
) {
	if (name) {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}
	return email?.[0]?.toUpperCase() || "U";
}

export function ProfileButtonClient({ user }: ProfileButtonClientProps) {
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [switchingTo, setSwitchingTo] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const router = useRouter();
	const queryClient = useQueryClient();

	const { data: deviceSessions } = useQuery({
		queryKey: ["device-sessions"],
		queryFn: async () => {
			const result = await authClient.multiSession.listDeviceSessions({});
			return result.data as DeviceSession[] | null;
		},
		enabled: isOpen,
		staleTime: 30 * 1000,
	});

	const handleLogout = async () => {
		setIsLoggingOut(true);
		setIsOpen(false);
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					toast.success("Logged out successfully");
					router.push("/login");
				},
				onError: (error) => {
					router.push("/login");
					toast.error(error.error.message || "Failed to log out");
				},
			},
		});
		setIsLoggingOut(false);
	};

	const handleSwitchAccount = async (session: DeviceSession) => {
		setSwitchingTo(session.session.id);
		setIsOpen(false);

		const result = await authClient.multiSession.setActive({
			sessionToken: session.session.token,
		});

		if (result.error) {
			toast.error(result.error.message || "Failed to switch account");
			setSwitchingTo(null);
			return;
		}

		queryClient.removeQueries({
			predicate: (query) => {
				const queryKey = query.queryKey;
				return !PRESERVED_QUERY_KEYS.some(
					(preserved) =>
						preserved.length <= queryKey.length &&
						preserved.every((key, i) => queryKey[i] === key)
				);
			},
		});

		toast.success(`Switched to ${session.user.name || session.user.email}`);
		router.refresh();
		setSwitchingTo(null);
	};

	const userInitials = getInitials(user?.name, user?.email);

	const otherSessions =
		deviceSessions?.filter((session) => session.user.email !== user?.email) ??
		[];
	const hasMultipleAccounts = otherSessions.length > 0;

	return (
		<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip content={user?.email ?? "Account"} side="right">
				<DropdownMenu.Trigger
					aria-label="Profile menu"
					className="flex size-8 items-center justify-center rounded-full transition-opacity duration-(--duration-quick) ease-(--ease-smooth) hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					disabled={isLoggingOut || Boolean(switchingTo)}
					render={<button type="button" />}
				>
					<Avatar
						alt={user?.name || "User"}
						className="size-8"
						fallback={userInitials}
						src={user?.image || undefined}
					/>
				</DropdownMenu.Trigger>
			</Tooltip>

			<DropdownMenu.Content align="start" className="w-56" side="right">
				{hasMultipleAccounts &&
					otherSessions.map((session) => (
						<DropdownMenu.Item
							disabled={switchingTo === session.session.id}
							key={session.session.id}
							onClick={() => handleSwitchAccount(session)}
						>
							<Avatar
								alt={session.user.name}
								className="size-5 text-[10px]"
								fallback={getInitials(session.user.name, session.user.email)}
								src={session.user.image || undefined}
							/>
							<Text className="min-w-0 flex-1 truncate" variant="body">
								{session.user.email}
							</Text>
							{switchingTo === session.session.id ? (
								<SpinnerGapIcon className="size-3.5 animate-spin text-muted-foreground" />
							) : (
								<CaretRightIcon className="size-3.5 text-muted-foreground" />
							)}
						</DropdownMenu.Item>
					))}

				{hasMultipleAccounts && <DropdownMenu.Separator />}

				<DropdownMenu.Item
					onClick={() => {
						setIsOpen(false);
						router.push("/login?add_account=true");
					}}
				>
					<PlusIcon className="size-4" />
					Add account
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onClick={() => {
						setIsOpen(false);
						router.push("/settings/account");
					}}
				>
					<GearIcon className="size-4" weight="duotone" />
					Settings
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onClick={() => {
						setIsOpen(false);
						router.push("/billing");
					}}
				>
					<CreditCardIcon className="size-4" weight="duotone" />
					Billing
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					disabled={isLoggingOut}
					onClick={handleLogout}
					variant="destructive"
				>
					<SignOutIcon className="size-4" weight="duotone" />
					{isLoggingOut ? "Signing out…" : "Sign out"}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
