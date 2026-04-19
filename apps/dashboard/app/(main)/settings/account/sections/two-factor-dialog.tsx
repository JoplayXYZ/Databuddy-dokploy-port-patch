"use client";

import { authClient } from "@databuddy/auth/client";
import {
	CaretDown,
	CheckCircle,
	Copy,
	DeviceMobile,
	Key,
	ShieldCheck,
	WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { setPasswordForOAuthUser } from "@/app/actions/users";
import { Button } from "@/components/ds/button";
import { Dialog } from "@/components/ds/dialog";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Text } from "@/components/ds/text";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type TwoFactorStep =
	| "set-password"
	| "password"
	| "setup"
	| "verify"
	| "backup"
	| "manage";

interface TwoFactorDialogProps {
	hasCredentialAccount: boolean;
	isEnabled: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
}

const MIN_PASSWORD_LENGTH = 8;
const TOTP_SECRET_REGEX = /secret=([A-Z2-7]+)/i;

function extractSecretFromTotpUri(uri: string): string {
	const match = uri.match(TOTP_SECRET_REGEX);
	return match?.[1] ?? "";
}

export function TwoFactorDialog({
	open,
	onOpenChange,
	isEnabled,
	hasCredentialAccount,
	onSuccess,
}: TwoFactorDialogProps) {
	const initialStep = useMemo((): TwoFactorStep => {
		if (isEnabled) {
			return "manage";
		}
		if (!hasCredentialAccount) {
			return "set-password";
		}
		return "password";
	}, [isEnabled, hasCredentialAccount]);

	const [step, setStep] = useState<TwoFactorStep>(initialStep);
	const [password, setPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [totpUri, setTotpUri] = useState("");
	const [secret, setSecret] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [verifyCode, setVerifyCode] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [copiedBackup, setCopiedBackup] = useState(false);

	useEffect(() => {
		if (!open) {
			setStep(initialStep);
			setPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setTotpUri("");
			setSecret("");
			setBackupCodes([]);
			setVerifyCode("");
			setShowSecret(false);
			setCopiedBackup(false);
		}
	}, [open, initialStep]);

	const isNewPasswordValid =
		newPassword.length >= MIN_PASSWORD_LENGTH &&
		newPassword === confirmPassword;

	const setPasswordMutation = useMutation({
		mutationFn: async () => {
			if (newPassword !== confirmPassword) {
				throw new Error("Passwords do not match");
			}
			if (newPassword.length < MIN_PASSWORD_LENGTH) {
				throw new Error(
					`Password must be at least ${MIN_PASSWORD_LENGTH} characters`
				);
			}
			if (hasCredentialAccount) {
				throw new Error(
					"You already have a password. Use change password instead."
				);
			}
			const result = await setPasswordForOAuthUser(newPassword);
			if (result.error) {
				throw new Error(result.error);
			}
			return result;
		},
		onSuccess: () => {
			toast.success("Password set successfully!");
			setPassword(newPassword);
			setStep("password");
			onSuccess();
		},
	});

	const enableMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.twoFactor.enable({ password });
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: (data) => {
			if (data?.totpURI) {
				setTotpUri(data.totpURI);
				setSecret(extractSecretFromTotpUri(data.totpURI));
			}
			if (data?.backupCodes) {
				setBackupCodes(data.backupCodes);
			}
			setStep("setup");
		},
	});

	const verifyMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.twoFactor.verifyTotp({
				code: verifyCode,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: () => {
			toast.success("Two-factor authentication enabled!");
			setStep("backup");
			onSuccess();
		},
	});

	const disableMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.twoFactor.disable({ password });
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: () => {
			toast.success("Two-factor authentication disabled");
			onSuccess();
			onOpenChange(false);
		},
	});

	const regenerateBackupMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.twoFactor.generateBackupCodes({
				password,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: (data) => {
			if (data?.backupCodes) {
				setBackupCodes(data.backupCodes);
				toast.success("New backup codes generated");
			}
		},
	});

	const handleCopyBackupCodes = useCallback(async () => {
		const codesText = backupCodes.join("\n");
		await navigator.clipboard.writeText(codesText);
		setCopiedBackup(true);
		toast.success("Backup codes copied to clipboard");
		setTimeout(() => setCopiedBackup(false), 2000);
	}, [backupCodes]);

	const handleCopySecret = useCallback(async () => {
		await navigator.clipboard.writeText(secret);
		toast.success("Secret key copied to clipboard");
	}, [secret]);

	const isPending =
		setPasswordMutation.isPending ||
		enableMutation.isPending ||
		verifyMutation.isPending ||
		disableMutation.isPending ||
		regenerateBackupMutation.isPending;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<Dialog.Content className="max-w-md">
				<Dialog.Header>
					<Dialog.Title>
						{step === "set-password" && "Set Up a Password"}
						{step === "password" && "Enable Two-Factor Authentication"}
						{step === "setup" && "Set Up Authenticator"}
						{step === "verify" && "Verify Your Setup"}
						{step === "backup" && "Save Your Backup Codes"}
						{step === "manage" && "Manage Two-Factor Authentication"}
					</Dialog.Title>
					<Dialog.Description>
						{step === "set-password" &&
							"You signed up with a social account. Create a password to enable 2FA."}
						{step === "password" &&
							"Enter your password to begin setting up 2FA."}
						{step === "setup" &&
							"Link your account to an authenticator app for extra security."}
						{step === "verify" &&
							"Confirm your authenticator is set up correctly."}
						{step === "backup" &&
							"Store these codes safely. Each can only be used once."}
						{step === "manage" &&
							"Manage your two-factor authentication settings."}
					</Dialog.Description>
				</Dialog.Header>

				<Dialog.Body>
					{step === "set-password" && (
						<div className="space-y-4">
							<div className="flex items-center gap-3 rounded-md border border-border/60 bg-blue-500/10 p-4">
								<div className="flex size-10 items-center justify-center rounded-full bg-blue-500/20">
									<Key
										className="size-5 text-blue-600 dark:text-blue-400"
										weight="duotone"
									/>
								</div>
								<div>
									<Text variant="label">Password required</Text>
									<Text tone="muted" variant="caption">
										2FA requires a password for verification
									</Text>
								</div>
							</div>

							<Field>
								<Field.Label>New Password</Field.Label>
								<Input
									autoComplete="new-password"
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="Min. 8 characters"
									type="password"
									value={newPassword}
								/>
							</Field>

							<Field>
								<Field.Label>Confirm Password</Field.Label>
								<Input
									autoComplete="new-password"
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Confirm your password"
									type="password"
									value={confirmPassword}
								/>
							</Field>
						</div>
					)}

					{step === "password" && (
						<Field>
							<Field.Label>Password</Field.Label>
							<Input
								autoComplete="current-password"
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								type="password"
								value={password}
							/>
						</Field>
					)}

					{step === "setup" && (
						<div className="space-y-5">
							<div className="flex items-start gap-3">
								<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
									1
								</div>
								<div className="flex-1 space-y-1">
									<Text variant="label">Install an authenticator app</Text>
									<Text tone="muted" variant="caption">
										Google Authenticator, Authy, 1Password, or any TOTP app
									</Text>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
									2
								</div>
								<div className="flex-1 space-y-3">
									<div>
										<Text variant="label">Scan this QR code</Text>
										<Text tone="muted" variant="caption">
											Open your app and scan to add your account
										</Text>
									</div>

									<div className="flex justify-center">
										<div className="rounded-lg border-2 border-dashed bg-white p-3">
											<QRCodeSVG
												bgColor="transparent"
												fgColor="#000"
												level="M"
												size={160}
												value={totpUri}
											/>
										</div>
									</div>

									<div className="space-y-2">
										<button
											className="flex w-full items-center gap-2 text-left text-xs"
											onClick={() => setShowSecret(!showSecret)}
											type="button"
										>
											<DeviceMobile
												className="size-4 text-muted-foreground"
												weight="duotone"
											/>
											<span className="flex-1 text-muted-foreground">
												Can't scan? Enter code manually
											</span>
											<CaretDown
												className={cn(
													"size-3 text-muted-foreground transition-transform",
													showSecret && "rotate-180"
												)}
											/>
										</button>

										{showSecret && (
											<div className="rounded-md border border-border/60 bg-secondary/50 p-3">
												<Text className="mb-1.5" tone="muted" variant="caption">
													Secret key
												</Text>
												<div className="flex items-center justify-between gap-2">
													<code className="flex-1 select-all break-all font-mono text-xs">
														{secret}
													</code>
													<Button
														onClick={handleCopySecret}
														size="sm"
														variant="ghost"
													>
														<Copy className="size-3.5" />
													</Button>
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					)}

					{step === "verify" && (
						<div className="flex flex-col items-center space-y-6">
							<div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
								<ShieldCheck className="size-7 text-primary" weight="duotone" />
							</div>

							<div className="space-y-4 text-center">
								<div className="space-y-1">
									<Text variant="label">Enter verification code</Text>
									<Text tone="muted" variant="caption">
										Open your authenticator app and enter the 6-digit code
									</Text>
								</div>

								<div className="flex justify-center">
									<InputOTP
										autoFocus
										maxLength={6}
										onChange={setVerifyCode}
										value={verifyCode}
									>
										<InputOTPGroup>
											<InputOTPSlot index={0} />
											<InputOTPSlot index={1} />
											<InputOTPSlot index={2} />
											<InputOTPSlot index={3} />
											<InputOTPSlot index={4} />
											<InputOTPSlot index={5} />
										</InputOTPGroup>
									</InputOTP>
								</div>
							</div>
						</div>
					)}

					{step === "backup" && (
						<div className="space-y-4">
							<div className="rounded-md border border-border/60 bg-secondary/30 p-4">
								<div className="grid grid-cols-2 gap-2">
									{backupCodes.map((code, i) => (
										<code
											className="rounded-md bg-card px-2 py-1 text-center font-mono text-sm"
											key={i}
										>
											{code}
										</code>
									))}
								</div>
							</div>

							<div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-warning">
								<WarningCircle className="size-5 shrink-0" />
								<Text variant="caption">
									Store these codes in a safe place. Each code can only be used
									once to recover your account if you lose access to your
									authenticator app.
								</Text>
							</div>
						</div>
					)}

					{step === "manage" && (
						<div className="space-y-4">
							<div className="flex items-center gap-3 rounded-md border border-border/60 bg-success/10 p-4">
								<div className="flex size-10 items-center justify-center rounded-full bg-success/20">
									<ShieldCheck
										className="size-5 text-success"
										weight="duotone"
									/>
								</div>
								<div>
									<Text variant="label">2FA is enabled</Text>
									<Text tone="muted" variant="caption">
										Your account has an extra layer of security
									</Text>
								</div>
							</div>

							<Field>
								<Field.Label>Password (required for changes)</Field.Label>
								<Input
									autoComplete="current-password"
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									type="password"
									value={password}
								/>
							</Field>

							{backupCodes.length > 0 && (
								<div className="rounded-md border border-border/60 bg-secondary/30 p-4">
									<div className="mb-2 flex items-center justify-between">
										<Text variant="label">Backup Codes</Text>
										<Button
											onClick={handleCopyBackupCodes}
											size="sm"
											variant="ghost"
										>
											{copiedBackup ? (
												<CheckCircle className="size-3.5 text-success" />
											) : (
												<Copy className="size-3.5" />
											)}
										</Button>
									</div>
									<div className="grid grid-cols-2 gap-2">
										{backupCodes.map((code, i) => (
											<code
												className="rounded-md bg-card px-2 py-1 text-center font-mono text-sm"
												key={i}
											>
												{code}
											</code>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</Dialog.Body>

				<Dialog.Footer>
					{step === "set-password" && (
						<>
							<Dialog.Close>
								<Button variant="secondary">Cancel</Button>
							</Dialog.Close>
							<Button
								disabled={!isNewPasswordValid || isPending}
								loading={setPasswordMutation.isPending}
								onClick={() => setPasswordMutation.mutate()}
							>
								Set Password & Continue
							</Button>
						</>
					)}

					{step === "password" && (
						<>
							<Dialog.Close>
								<Button variant="secondary">Cancel</Button>
							</Dialog.Close>
							<Button
								disabled={!password || isPending}
								loading={enableMutation.isPending}
								onClick={() => enableMutation.mutate()}
							>
								Continue
							</Button>
						</>
					)}

					{step === "setup" && (
						<>
							<Button onClick={() => setStep("password")} variant="secondary">
								Back
							</Button>
							<Button onClick={() => setStep("verify")}>
								Continue to Verify
							</Button>
						</>
					)}

					{step === "verify" && (
						<>
							<Button onClick={() => setStep("setup")} variant="secondary">
								Back
							</Button>
							<Button
								disabled={verifyCode.length !== 6 || isPending}
								loading={verifyMutation.isPending}
								onClick={() => verifyMutation.mutate()}
							>
								Verify & Enable
							</Button>
						</>
					)}

					{step === "backup" && (
						<>
							<Button
								className="flex-1"
								onClick={handleCopyBackupCodes}
								variant="secondary"
							>
								{copiedBackup ? (
									<>
										<CheckCircle className="size-3.5 text-success" />
										Copied!
									</>
								) : (
									<>
										<Copy className="size-3.5" />
										Copy Codes
									</>
								)}
							</Button>
							<Button className="flex-1" onClick={() => onOpenChange(false)}>
								Done
							</Button>
						</>
					)}

					{step === "manage" && (
						<>
							<Button
								disabled={!password || isPending}
								loading={regenerateBackupMutation.isPending}
								onClick={() => regenerateBackupMutation.mutate()}
								variant="secondary"
							>
								New Backup Codes
							</Button>
							<Button
								disabled={!password || isPending}
								loading={disableMutation.isPending}
								onClick={() => disableMutation.mutate()}
								tone="danger"
							>
								Disable 2FA
							</Button>
						</>
					)}
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog>
	);
}
