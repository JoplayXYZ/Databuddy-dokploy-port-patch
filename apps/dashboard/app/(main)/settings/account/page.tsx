"use client";

import { authClient } from "@databuddy/auth/client";
import type { Icon } from "@phosphor-icons/react";
import {
	GithubLogo,
	GoogleLogo,
	Key,
	LinkBreak,
	Link as LinkIcon,
	ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ds/avatar";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Dialog } from "@/components/ds/dialog";
import { Divider } from "@/components/ds/divider";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Skeleton } from "@/components/ds/skeleton";
import { Text } from "@/components/ds/text";
import dayjs from "@/lib/dayjs";
import { TwoFactorDialog } from "./sections/two-factor-dialog";

interface Account {
	accountId: string;
	createdAt: Date;
	id: string;
	providerId: string;
}

type SocialProvider = "google" | "github";

const SOCIAL_PROVIDERS: SocialProvider[] = ["google", "github"];

const PROVIDER_CONFIG: Record<string, { icon: Icon; name: string }> = {
	google: { icon: GoogleLogo, name: "Google" },
	github: { icon: GithubLogo, name: "GitHub" },
	credential: { icon: Key, name: "Password" },
};

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function ChangePasswordDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const changePasswordMutation = useMutation({
		mutationFn: async () => {
			if (newPassword !== confirmPassword) {
				throw new Error("Passwords do not match");
			}
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: false,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: () => {
			toast.success("Password changed successfully");
			onOpenChange(false);
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		},
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Change Password</Dialog.Title>
					<Dialog.Description>
						Enter your current password and choose a new one.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Body className="space-y-4">
					<Field>
						<Field.Label>Current Password</Field.Label>
						<Input
							autoComplete="current-password"
							onChange={(e) => setCurrentPassword(e.target.value)}
							placeholder="••••••••"
							type="password"
							value={currentPassword}
						/>
					</Field>
					<Field>
						<Field.Label>New Password</Field.Label>
						<Input
							autoComplete="new-password"
							onChange={(e) => setNewPassword(e.target.value)}
							placeholder="••••••••"
							type="password"
							value={newPassword}
						/>
					</Field>
					<Field>
						<Field.Label>Confirm New Password</Field.Label>
						<Input
							autoComplete="new-password"
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="••••••••"
							type="password"
							value={confirmPassword}
						/>
					</Field>
				</Dialog.Body>
				<Dialog.Footer>
					<Dialog.Close>
						<Button variant="secondary">Cancel</Button>
					</Dialog.Close>
					<Button
						disabled={
							!(currentPassword && newPassword && confirmPassword) ||
							changePasswordMutation.isPending
						}
						loading={changePasswordMutation.isPending}
						onClick={() => changePasswordMutation.mutate()}
					>
						Change Password
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog>
	);
}

function UnlinkConfirmDialog({
	provider,
	isPending,
	onConfirm,
	onClose,
}: {
	provider: SocialProvider | null;
	isPending: boolean;
	onConfirm: () => void;
	onClose: () => void;
}) {
	return (
		<Dialog onOpenChange={(open) => !open && onClose()} open={!!provider}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Unlink Account</Dialog.Title>
					<Dialog.Description>
						Are you sure you want to unlink your{" "}
						{provider ? PROVIDER_CONFIG[provider]?.name : ""} account? You can
						reconnect it later.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button onClick={onClose} variant="secondary">
						Cancel
					</Button>
					<Button loading={isPending} onClick={onConfirm} tone="danger">
						Unlink
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog>
	);
}

export default function AccountSettingsPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } =
		authClient.useSession();
	const user = session?.user;

	const [name, setName] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [showPasswordDialog, setShowPasswordDialog] = useState(false);
	const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
	const [unlinkProvider, setUnlinkProvider] = useState<SocialProvider | null>(
		null
	);

	useEffect(() => {
		if (user) {
			setName(user.name ?? "");
			setImageUrl(user.image ?? "");
		}
	}, [user]);

	const { data: accounts = [], isLoading: isAccountsLoading } = useQuery({
		queryKey: ["user-accounts"],
		queryFn: async () => {
			const result = await authClient.listAccounts();
			if (result.error) {
				throw new Error(result.error.message);
			}
			return (result.data ?? []) as Account[];
		},
	});

	const updateProfileMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.updateUser({
				name,
				image: imageUrl || undefined,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: () => {
			toast.success("Profile updated successfully");
			queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
		},
	});

	const linkSocial = useMutation({
		mutationFn: async (provider: SocialProvider) => {
			const result = await authClient.linkSocial({
				provider,
				callbackURL: window.location.href,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
	});

	const unlinkAccount = useMutation({
		mutationFn: async (providerId: string) => {
			const result = await authClient.unlinkAccount({ providerId });
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: () => {
			toast.success("Account unlinked successfully");
			queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
		},
	});

	const hasCredentialAccount = accounts.some(
		(acc) => acc.providerId === "credential"
	);
	const hasChanges =
		name !== (user?.name ?? "") || imageUrl !== (user?.image ?? "");

	const isLoading = isSessionLoading || isAccountsLoading;

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-6 p-5">
					<Card>
						<Card.Header>
							<Card.Title>Profile Photo</Card.Title>
							<Card.Description>
								Upload a photo to personalize your account
							</Card.Description>
						</Card.Header>
						<Card.Content>
							{isLoading ? (
								<div className="flex items-center gap-4">
									<Skeleton className="size-16 rounded-full" />
									<div className="flex-1 space-y-2">
										<Skeleton className="h-8 w-full" />
										<Skeleton className="h-4 w-40" />
									</div>
								</div>
							) : (
								<div className="flex items-center gap-4">
									<Avatar
										alt={name}
										className="size-16 text-lg"
										fallback={getInitials(name || "User")}
										src={imageUrl}
									/>
									<div className="flex-1">
										<Field>
											<Field.Label>Image URL</Field.Label>
											<Input
												onChange={(e) => setImageUrl(e.target.value)}
												placeholder="https://example.com/avatar.jpg"
												value={imageUrl}
											/>
											<Field.Description>
												Enter a URL for your profile photo
											</Field.Description>
										</Field>
									</div>
								</div>
							)}
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>Basic Information</Card.Title>
							<Card.Description>
								Update your personal information
							</Card.Description>
						</Card.Header>
						<Card.Content>
							{isLoading ? (
								<div className="grid gap-4 sm:grid-cols-2">
									<Skeleton className="h-16 w-full" />
									<Skeleton className="h-16 w-full" />
								</div>
							) : (
								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<Field.Label>Full Name</Field.Label>
										<Input
											onChange={(e) => setName(e.target.value)}
											placeholder="Your name…"
											value={name}
										/>
									</Field>
									<Field>
										<Field.Label>Email Address</Field.Label>
										<Input disabled type="email" value={user?.email ?? ""} />
										<Field.Description>
											Email cannot be changed
										</Field.Description>
									</Field>
								</div>
							)}
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>Account Status</Card.Title>
							<Card.Description>
								Your account verification and security status
							</Card.Description>
						</Card.Header>
						<Card.Content>
							{isLoading ? (
								<div className="space-y-3">
									<Skeleton className="h-5 w-full" />
									<Skeleton className="h-5 w-full" />
									<Skeleton className="h-5 w-full" />
								</div>
							) : (
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Text tone="muted" variant="body">
											Email verified
										</Text>
										<Badge
											variant={user?.emailVerified ? "success" : "warning"}
										>
											{user?.emailVerified ? "Yes" : "No"}
										</Badge>
									</div>
									<Divider />
									<div className="flex items-center justify-between">
										<Text tone="muted" variant="body">
											2FA enabled
										</Text>
										<Badge
											variant={user?.twoFactorEnabled ? "success" : "muted"}
										>
											{user?.twoFactorEnabled ? "Yes" : "No"}
										</Badge>
									</div>
									<Divider />
									<div className="flex items-center justify-between">
										<Text tone="muted" variant="body">
											Member since
										</Text>
										<Text variant="label">
											{user?.createdAt
												? dayjs(user.createdAt).format("MMM YYYY")
												: "—"}
										</Text>
									</div>
								</div>
							)}
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>Security</Card.Title>
							<Card.Description>
								Secure your account with additional authentication
							</Card.Description>
						</Card.Header>
						<Card.Content className="space-y-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="min-w-0 flex-1">
									<Text variant="label">Two-Factor Authentication</Text>
									<Text tone="muted" variant="caption">
										Add an extra layer of security to your account
									</Text>
								</div>
								<Button
									onClick={() => setShowTwoFactorDialog(true)}
									size="sm"
									variant="secondary"
								>
									<ShieldCheck className="size-3.5" weight="duotone" />
									{user?.twoFactorEnabled ? "Manage" : "Enable"}
								</Button>
							</div>

							{hasCredentialAccount && (
								<>
									<Divider />
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="min-w-0 flex-1">
											<Text variant="label">Change Password</Text>
											<Text tone="muted" variant="caption">
												Update your password regularly for security
											</Text>
										</div>
										<Button
											onClick={() => setShowPasswordDialog(true)}
											size="sm"
											variant="secondary"
										>
											<Key className="size-3.5" weight="duotone" />
											Change
										</Button>
									</div>
								</>
							)}
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>Connected Identities</Card.Title>
							<Card.Description>
								Link your accounts for easier sign-in
							</Card.Description>
						</Card.Header>
						<Card.Content className="space-y-2">
							{isAccountsLoading ? (
								<div className="space-y-2">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
								</div>
							) : (
								<>
									{SOCIAL_PROVIDERS.map((provider) => {
										const config = PROVIDER_CONFIG[provider];
										const ProviderIcon = config.icon;
										const connectedAccount = accounts.find(
											(acc) => acc.providerId === provider
										);
										const isOnlyAccount =
											accounts.length === 1 && !!connectedAccount;

										return (
											<div
												className="flex items-center justify-between py-2"
												key={provider}
											>
												<div className="flex items-center gap-3">
													<ProviderIcon className="size-5" weight="duotone" />
													<Text variant="label">{config.name}</Text>
												</div>
												{connectedAccount ? (
													<div className="flex items-center gap-2">
														<Button
															aria-label={
																isOnlyAccount
																	? "Cannot unlink your only login method"
																	: `Unlink ${config.name}`
															}
															disabled={isOnlyAccount}
															onClick={() => setUnlinkProvider(provider)}
															size="sm"
															variant="ghost"
														>
															<LinkBreak className="size-3.5" />
														</Button>
														<Badge variant="success">Connected</Badge>
													</div>
												) : (
													<Button
														disabled={linkSocial.isPending}
														loading={linkSocial.isPending}
														onClick={() => linkSocial.mutate(provider)}
														size="sm"
														variant="secondary"
													>
														<LinkIcon className="size-3.5" />
														Connect
													</Button>
												)}
											</div>
										);
									})}

									{hasCredentialAccount && (
										<div className="flex items-center justify-between py-2">
											<div className="flex items-center gap-3">
												<Key className="size-5" weight="duotone" />
												<Text variant="label">Password</Text>
											</div>
											<Badge variant="success">Connected</Badge>
										</div>
									)}
								</>
							)}
						</Card.Content>
					</Card>
				</div>
			</div>

			{hasChanges && (
				<div className="angled-rectangle-gradient flex shrink-0 items-center justify-between border-t bg-muted px-5 py-3">
					<Text tone="muted" variant="caption">
						You have unsaved changes
					</Text>
					<div className="flex items-center gap-2">
						<Button
							disabled={updateProfileMutation.isPending}
							onClick={() => {
								setName(user?.name ?? "");
								setImageUrl(user?.image ?? "");
							}}
							size="sm"
							variant="ghost"
						>
							Discard
						</Button>
						<Button
							loading={updateProfileMutation.isPending}
							onClick={() => updateProfileMutation.mutate()}
							size="sm"
						>
							Save Changes
						</Button>
					</div>
				</div>
			)}

			<ChangePasswordDialog
				onOpenChange={setShowPasswordDialog}
				open={showPasswordDialog}
			/>
			<TwoFactorDialog
				hasCredentialAccount={hasCredentialAccount}
				isEnabled={user?.twoFactorEnabled ?? false}
				onOpenChange={setShowTwoFactorDialog}
				onSuccess={() => {
					queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
					queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
				}}
				open={showTwoFactorDialog}
			/>
			<UnlinkConfirmDialog
				isPending={unlinkAccount.isPending}
				onClose={() => setUnlinkProvider(null)}
				onConfirm={() => {
					if (unlinkProvider) {
						unlinkAccount.mutate(unlinkProvider, {
							onSuccess: () => setUnlinkProvider(null),
						});
					}
				}}
				provider={unlinkProvider}
			/>
		</div>
	);
}
