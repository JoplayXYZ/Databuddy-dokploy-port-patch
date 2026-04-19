"use client";

import { API_SCOPES, type ApiScope } from "@databuddy/api-keys/scopes";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowsClockwise,
	CheckCircle,
	Copy,
	Key,
	Prohibit,
	Trash,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Accordion } from "@/components/ds/accordion";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Checkbox } from "@/components/ds/checkbox";
import { Dialog } from "@/components/ds/dialog";
import { Divider } from "@/components/ds/divider";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Sheet } from "@/components/ds/sheet";
import { Switch } from "@/components/ds/switch";
import { Text } from "@/components/ds/text";
import dayjs from "@/lib/dayjs";
import { orpc } from "@/lib/orpc";
import { type ApiKeyListItem, SCOPE_OPTIONS } from "./api-key-types";

interface ApiKeyDetailDialogProps {
	apiKey: ApiKeyListItem | null;
	onOpenChangeAction: (open: boolean) => void;
	open: boolean;
}

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	enabled: z.boolean(),
	expiresAt: z.string().optional(),
	scopes: z.array(z.string()),
});

type FormData = z.infer<typeof formSchema>;

function getEffectiveScopes(
	key: ApiKeyListItem | { scopes: string[] }
): ApiScope[] {
	const scopes = key.scopes ?? [];
	return scopes.filter((s) =>
		(API_SCOPES as readonly string[]).includes(s)
	) as ApiScope[];
}

export function ApiKeyDetailDialog({
	apiKey,
	open,
	onOpenChangeAction,
}: ApiKeyDetailDialogProps) {
	const queryClient = useQueryClient();
	const [newSecret, setNewSecret] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const { data: fullKey } = useQuery({
		...orpc.apikeys.getById.queryOptions({ input: { id: apiKey?.id ?? "" } }),
		enabled: !!apiKey?.id && open,
	});

	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			enabled: true,
			expiresAt: "",
			scopes: [] as string[],
		},
	});

	const lastResetKeyId = useRef<string | null>(null);

	useEffect(() => {
		if (!apiKey?.id) {
			return;
		}
		if (lastResetKeyId.current === apiKey.id) {
			return;
		}
		lastResetKeyId.current = apiKey.id;
		const keyToUse = fullKey?.id === apiKey.id ? fullKey : apiKey;
		form.reset({
			name: keyToUse.name,
			enabled: keyToUse.enabled && !keyToUse.revokedAt,
			expiresAt: keyToUse.expiresAt
				? new Date(keyToUse.expiresAt).toISOString().slice(0, 10)
				: "",
			scopes: getEffectiveScopes(keyToUse),
		});
	}, [apiKey?.id, apiKey, fullKey, form]);

	const handleClose = () => {
		onOpenChangeAction(false);
		setTimeout(() => {
			lastResetKeyId.current = null;
			setNewSecret(null);
			setCopied(false);
			form.reset();
		}, 200);
	};

	const invalidateQueries = () => {
		queryClient.invalidateQueries({ queryKey: orpc.apikeys.list.key() });
		if (apiKey?.id) {
			queryClient.invalidateQueries({
				queryKey: orpc.apikeys.getById.key({ input: { id: apiKey.id } }),
			});
		}
	};

	const toggleScope = (scope: string) => {
		const current = form.getValues("scopes");
		const next = current.includes(scope)
			? current.filter((s) => s !== scope)
			: [...current, scope];
		form.setValue("scopes", next);
	};

	const updateMutation = useMutation({
		...orpc.apikeys.update.mutationOptions(),
		onSuccess: () => {
			invalidateQueries();
			toast.success("API key updated");
		},
		onError: () => {
			toast.error("Failed to update API key");
		},
	});

	const rotateMutation = useMutation({
		...orpc.apikeys.rotate.mutationOptions(),
		onSuccess: (res) => {
			setNewSecret(res.secret);
			invalidateQueries();
		},
	});

	const revokeMutation = useMutation({
		...orpc.apikeys.revoke.mutationOptions(),
		onSuccess: invalidateQueries,
	});

	const deleteMutation = useMutation({
		...orpc.apikeys.delete.mutationOptions(),
		onSuccess: () => {
			invalidateQueries();
			handleClose();
		},
	});

	const handleCopy = async () => {
		if (!newSecret) {
			return;
		}
		try {
			await navigator.clipboard.writeText(newSecret);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback
		}
	};

	const onSubmit = form.handleSubmit((values) => {
		if (!apiKey) {
			return;
		}
		type MutationInput = Parameters<typeof updateMutation.mutate>[0];
		const payload: MutationInput = {
			id: apiKey.id,
			name: values.name,
			enabled: values.enabled,
			expiresAt: values.expiresAt || null,
		};
		const scopes = (values.scopes ?? []) as NonNullable<
			MutationInput["scopes"]
		>;
		if (fullKey?.resources === undefined) {
			payload.scopes = scopes;
		} else {
			const existing = fullKey.resources as Record<string, string[]>;
			const websiteResources = Object.fromEntries(
				Object.entries(existing).filter(([k]) => k !== "global")
			) as MutationInput["resources"];
			payload.scopes = [];
			payload.resources = {
				...websiteResources,
				...(scopes.length > 0 && { global: scopes }),
			};
		}
		updateMutation.mutate(payload);
	});

	const isActive = apiKey?.enabled && !apiKey?.revokedAt;

	if (!apiKey) {
		return null;
	}

	return (
		<>
			<Sheet onOpenChange={handleClose} open={open}>
				<Sheet.Content className="sm:max-w-md" side="right">
					<Sheet.Header>
						<div className="flex items-start gap-3">
							<div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
								<Key className="text-primary" size={14} weight="fill" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<Sheet.Title className="truncate">{apiKey.name}</Sheet.Title>
									<Badge size="sm" variant={isActive ? "success" : "muted"}>
										{isActive ? "Active" : "Inactive"}
									</Badge>
								</div>
								<Sheet.Description className="font-mono">
									{apiKey.prefix}_{apiKey.start}••••
								</Sheet.Description>
							</div>
						</div>
					</Sheet.Header>

					<form
						className="flex flex-1 flex-col overflow-hidden"
						onSubmit={onSubmit}
					>
						<Sheet.Body className="space-y-0 px-0">
							{newSecret && (
								<div className="mx-5 mb-4 rounded-md border border-success/30 bg-success/5 p-3">
									<div className="mb-2 flex items-center gap-1.5">
										<CheckCircle
											className="text-success"
											size={13}
											weight="fill"
										/>
										<Text className="text-success" variant="label">
											New secret generated
										</Text>
									</div>
									<div className="group relative overflow-hidden rounded-md border border-success/20 bg-background">
										<div className="relative px-3 py-2.5">
											<code className="block break-all pr-8 font-mono text-[11px] text-foreground leading-relaxed">
												{newSecret}
											</code>
											<button
												className="absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-interactive-hover hover:text-foreground"
												onClick={handleCopy}
												type="button"
											>
												{copied ? (
													<CheckCircle
														className="text-success"
														size={13}
														weight="fill"
													/>
												) : (
													<Copy size={13} />
												)}
											</button>
										</div>
									</div>
									<Text className="mt-2" tone="muted" variant="caption">
										Copy this now — it won't be shown again.
									</Text>
								</div>
							)}

							<section className="px-5 py-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<Field.Label>Name</Field.Label>
										<Input {...form.register("name")} />
									</Field>
									<Field>
										<Field.Label>Expires</Field.Label>
										<Input type="date" {...form.register("expiresAt")} />
									</Field>
								</div>
							</section>

							<Divider />

							<section className="px-5 py-4">
								<Switch
									checked={form.watch("enabled")}
									description="Disable to temporarily block all requests using this key"
									label="Enabled"
									onCheckedChange={(v) =>
										form.setValue("enabled", v as boolean)
									}
								/>
							</section>

							<Divider />

							<Accordion defaultOpen>
								<Accordion.Trigger>
									<Text variant="label">Permissions</Text>
									<Badge className="ml-auto" size="sm" variant="muted">
										{form.watch("scopes").length} selected
									</Badge>
								</Accordion.Trigger>
								<Accordion.Content className="px-5">
									<div className="rounded-md border">
										{SCOPE_OPTIONS.map((scope, i) => {
											const selectedScopes = form.watch("scopes");
											const hasScope = selectedScopes.includes(scope.value);
											return (
												<div key={scope.value}>
													{i > 0 && <Divider />}
													<div className="px-3 py-2">
														<Checkbox
															checked={hasScope}
															label={
																<span className="flex items-center gap-2">
																	{scope.label}
																	{scope.value === "read:data" && (
																		<Badge size="sm" variant="muted">
																			default
																		</Badge>
																	)}
																</span>
															}
															onCheckedChange={() => toggleScope(scope.value)}
														/>
													</div>
												</div>
											);
										})}
									</div>
								</Accordion.Content>
							</Accordion>

							<Divider />

							<Accordion>
								<Accordion.Trigger>
									<Text variant="label">Info</Text>
								</Accordion.Trigger>
								<Accordion.Content className="px-5">
									<div className="flex flex-wrap gap-x-4 gap-y-1">
										<Text as="span" tone="muted" variant="caption">
											Created {dayjs(apiKey.createdAt).format("MMM D, YYYY")}
										</Text>
										{apiKey.expiresAt && (
											<Text as="span" tone="muted" variant="caption">
												Expires {dayjs(apiKey.expiresAt).format("MMM D, YYYY")}
											</Text>
										)}
										{apiKey.revokedAt && (
											<Text
												as="span"
												className="text-destructive"
												variant="caption"
											>
												Revoked {dayjs(apiKey.revokedAt).format("MMM D, YYYY")}
											</Text>
										)}
									</div>
								</Accordion.Content>
							</Accordion>

							<Divider />

							<Accordion>
								<Accordion.Trigger>
									<Text variant="label">Actions</Text>
								</Accordion.Trigger>
								<Accordion.Content className="px-5">
									<div className="flex items-center gap-2">
										<Button
											loading={rotateMutation.isPending}
											onClick={() => rotateMutation.mutate({ id: apiKey.id })}
											size="sm"
											variant="secondary"
										>
											<ArrowsClockwise size={14} />
											Rotate
										</Button>
										<Button
											disabled={!isActive}
											loading={revokeMutation.isPending}
											onClick={() => revokeMutation.mutate({ id: apiKey.id })}
											size="sm"
											variant="secondary"
										>
											<Prohibit size={14} />
											Revoke
										</Button>
										<Button
											className="ml-auto"
											onClick={() => setShowDeleteConfirm(true)}
											size="sm"
											tone="danger"
											variant="ghost"
										>
											<Trash size={14} />
											Delete
										</Button>
									</div>
								</Accordion.Content>
							</Accordion>
						</Sheet.Body>

						<Sheet.Footer>
							<Button onClick={handleClose} variant="secondary">
								Cancel
							</Button>
							<Button loading={updateMutation.isPending} type="submit">
								Save Changes
							</Button>
						</Sheet.Footer>
					</form>
					<Sheet.Close />
				</Sheet.Content>
			</Sheet>

			<Dialog onOpenChange={setShowDeleteConfirm} open={showDeleteConfirm}>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Delete API Key?</Dialog.Title>
						<Dialog.Description>
							This action cannot be undone. Any applications using this key will
							immediately lose access.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button
							onClick={() => setShowDeleteConfirm(false)}
							variant="secondary"
						>
							Cancel
						</Button>
						<Button
							loading={deleteMutation.isPending}
							onClick={() => deleteMutation.mutate({ id: apiKey.id })}
							tone="danger"
						>
							Delete
						</Button>
					</Dialog.Footer>
					<Dialog.Close />
				</Dialog.Content>
			</Dialog>
		</>
	);
}
