"use client";

import type { ApiScope } from "@databuddy/api-keys/scopes";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	CheckCircle,
	Copy,
	Key,
	Plus,
	Trash,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Accordion } from "@/components/ds/accordion";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Checkbox } from "@/components/ds/checkbox";
import { Divider } from "@/components/ds/divider";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Select } from "@/components/ds/select";
import { Sheet } from "@/components/ds/sheet";
import { Text } from "@/components/ds/text";
import { orpc } from "@/lib/orpc";
import { type ApiKeyAccessEntry, SCOPE_OPTIONS } from "./api-key-types";

interface ApiKeyCreateDialogProps {
	onOpenChangeAction: (open: boolean) => void;
	onSuccessAction: (data: {
		id: string;
		secret: string;
		prefix: string;
		start: string;
	}) => void;
	open: boolean;
	organizationId: string;
}

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
});

type FormData = z.infer<typeof formSchema>;

export function ApiKeyCreateDialog({
	open,
	onOpenChangeAction,
	organizationId,
	onSuccessAction,
}: ApiKeyCreateDialogProps) {
	const queryClient = useQueryClient();
	const [globalScopes, setGlobalScopes] = useState<ApiScope[]>(["read:data"]);
	const [websiteAccess, setWebsiteAccess] = useState<ApiKeyAccessEntry[]>([]);
	const [websiteToAdd, setWebsiteToAdd] = useState<string | undefined>();
	const [created, setCreated] = useState<{
		id: string;
		secret: string;
		prefix: string;
		start: string;
	} | null>(null);
	const [copied, setCopied] = useState(false);

	const { data: websites } = useQuery({
		...orpc.websites.list.queryOptions({ input: { organizationId } }),
		enabled: !!organizationId && open,
	});

	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: "" },
	});

	const mutation = useMutation({
		...orpc.apikeys.create.mutationOptions(),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: orpc.apikeys.list.key() });
			setCreated(res);
		},
	});

	const handleClose = () => {
		if (created) {
			onSuccessAction(created);
		}
		onOpenChangeAction(false);
		setTimeout(() => {
			form.reset();
			setGlobalScopes(["read:data"]);
			setWebsiteAccess([]);
			setWebsiteToAdd(undefined);
			setCreated(null);
			setCopied(false);
		}, 200);
	};

	const handleCopy = async () => {
		if (!created?.secret) {
			return;
		}
		try {
			await navigator.clipboard.writeText(created.secret);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback
		}
	};

	const toggleGlobalScope = (scope: ApiScope) => {
		setGlobalScopes((prev) =>
			prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
		);
	};

	const addWebsite = () => {
		if (!websiteToAdd) {
			return;
		}
		if (websiteAccess.some((e) => e.resourceId === websiteToAdd)) {
			return;
		}
		setWebsiteAccess((prev) => [
			...prev,
			{ resourceType: "website", resourceId: websiteToAdd, scopes: [] },
		]);
		setWebsiteToAdd(undefined);
	};

	const removeWebsite = (resourceId: string) => {
		setWebsiteAccess((prev) => prev.filter((e) => e.resourceId !== resourceId));
	};

	const toggleWebsiteScope = (resourceId: string, scope: ApiScope) => {
		setWebsiteAccess((prev) =>
			prev.map((entry) => {
				if (entry.resourceId !== resourceId) {
					return entry;
				}
				const scopes = entry.scopes.includes(scope)
					? entry.scopes.filter((s) => s !== scope)
					: [...entry.scopes, scope];
				return { ...entry, scopes };
			})
		);
	};

	const onSubmit = form.handleSubmit((values) => {
		const resources: Record<string, ApiScope[]> = {};

		if (globalScopes.length > 0) {
			resources.global = globalScopes;
		}

		for (const entry of websiteAccess) {
			if (entry.resourceId && entry.scopes.length > 0) {
				resources[`website:${entry.resourceId}`] = entry.scopes;
			}
		}

		mutation.mutate({
			name: values.name,
			organizationId,
			scopes: [],
			resources:
				Object.keys(resources).length > 0
					? (resources as Parameters<typeof mutation.mutate>[0]["resources"])
					: undefined,
		});
	});

	const nameError = form.formState.errors.name?.message;

	if (created) {
		return (
			<Sheet onOpenChange={handleClose} open={open}>
				<Sheet.Content className="sm:max-w-md" side="right">
					<div className="flex h-full flex-col items-center justify-center p-8 text-center">
						<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-success/15">
							<CheckCircle
								className="text-success"
								size={24}
								weight="duotone"
							/>
						</div>

						<Text className="mb-1" variant="heading">
							Key created
						</Text>
						<Text className="mb-5 max-w-[260px]" tone="muted" variant="caption">
							This secret is only shown once. Copy it now and store it somewhere
							safe.
						</Text>

						<div className="w-full space-y-4">
							<div className="group relative overflow-hidden rounded-md border bg-muted/40">
								<div className="px-3 py-2">
									<Text tone="muted" variant="caption">
										Secret key
									</Text>
								</div>
								<Divider />
								<div className="relative px-3 py-3">
									<code className="block break-all pr-8 font-mono text-[11px] text-foreground leading-relaxed">
										{created.secret}
									</code>
									<button
										className="absolute top-2.5 right-2.5 inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-interactive-hover hover:text-foreground"
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

							<Button className="w-full" onClick={handleClose}>
								Done
							</Button>
						</div>
					</div>
				</Sheet.Content>
			</Sheet>
		);
	}

	const availableWebsites = websites?.filter(
		(w) => !websiteAccess.some((e) => e.resourceId === w.id)
	);

	return (
		<Sheet onOpenChange={handleClose} open={open}>
			<Sheet.Content className="sm:max-w-md" side="right">
				<Sheet.Header>
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
							<Key className="text-primary" size={14} weight="fill" />
						</div>
						<div>
							<Sheet.Title>Create API Key</Sheet.Title>
							<Sheet.Description>
								Generate a key for programmatic access
							</Sheet.Description>
						</div>
					</div>
				</Sheet.Header>

				<form
					className="flex flex-1 flex-col overflow-hidden"
					onSubmit={onSubmit}
				>
					<Sheet.Body className="space-y-0 px-0">
						<section className="px-5 py-4">
							<Field error={!!nameError}>
								<Field.Label>Name</Field.Label>
								<Input
									placeholder="e.g., Production, CI/CD, Staging"
									{...form.register("name")}
								/>
								{nameError && <Field.Error>{nameError}</Field.Error>}
								<Field.Description>
									A label to identify this key later
								</Field.Description>
							</Field>
						</section>

						<Divider />

						<Accordion defaultOpen>
							<Accordion.Trigger>
								<Text variant="label">Permissions</Text>
								<Badge className="ml-auto" size="sm" variant="muted">
									{globalScopes.length} selected
								</Badge>
							</Accordion.Trigger>
							<Accordion.Content className="px-5">
								<div className="rounded-md border">
									{SCOPE_OPTIONS.map((scope, i) => (
										<div key={scope.value}>
											{i > 0 && <Divider />}
											<div className="px-3 py-2">
												<Checkbox
													checked={globalScopes.includes(scope.value)}
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
													onCheckedChange={() => toggleGlobalScope(scope.value)}
												/>
											</div>
										</div>
									))}
								</div>
							</Accordion.Content>
						</Accordion>

						{websites && websites.length > 0 && (
							<>
								<Divider />

								<Accordion>
									<Accordion.Trigger>
										<Text variant="label">Restrict to websites</Text>
										{websiteAccess.length > 0 && (
											<Badge className="ml-auto" size="sm" variant="muted">
												{websiteAccess.length} website
												{websiteAccess.length === 1 ? "" : "s"}
											</Badge>
										)}
									</Accordion.Trigger>
									<Accordion.Content className="space-y-3 px-5">
										<Text tone="muted" variant="caption">
											Limit this key to specific websites. Leave empty for
											workspace-wide access.
										</Text>

										<div className="flex gap-2">
											<Select
												onValueChange={(val) => setWebsiteToAdd(val as string)}
												value={websiteToAdd ?? ""}
											>
												<Select.Trigger className="flex-1" />
												<Select.Content>
													{availableWebsites?.map((w) => (
														<Select.Item key={w.id} value={w.id}>
															{w.name || w.domain}
														</Select.Item>
													))}
												</Select.Content>
											</Select>
											<Button
												disabled={!websiteToAdd}
												onClick={addWebsite}
												size="md"
												variant="secondary"
											>
												<Plus size={14} />
											</Button>
										</div>

										{websiteAccess.length > 0 && (
											<div className="space-y-2">
												{websiteAccess.map((entry) => {
													const website = websites.find(
														(w) => w.id === entry.resourceId
													);
													return (
														<div
															className="rounded-md border"
															key={entry.resourceId}
														>
															<div className="flex items-center justify-between px-3 py-2">
																<Text variant="label">
																	{website?.name ||
																		website?.domain ||
																		entry.resourceId}
																</Text>
																<Button
																	onClick={() =>
																		removeWebsite(entry.resourceId ?? "")
																	}
																	size="sm"
																	tone="danger"
																	variant="ghost"
																>
																	<Trash size={12} />
																</Button>
															</div>
															<Divider />
															<div className="px-3 py-1.5">
																{SCOPE_OPTIONS.slice(0, 6).map((scope) => (
																	<div className="py-1" key={scope.value}>
																		<Checkbox
																			checked={entry.scopes.includes(
																				scope.value
																			)}
																			label={scope.label}
																			onCheckedChange={() =>
																				toggleWebsiteScope(
																					entry.resourceId ?? "",
																					scope.value
																				)
																			}
																		/>
																	</div>
																))}
															</div>
														</div>
													);
												})}
											</div>
										)}
									</Accordion.Content>
								</Accordion>
							</>
						)}
					</Sheet.Body>

					<Sheet.Footer>
						<Button onClick={handleClose} variant="secondary">
							Cancel
						</Button>
						<Button loading={mutation.isPending} type="submit">
							Create Key
						</Button>
					</Sheet.Footer>
				</form>
				<Sheet.Close />
			</Sheet.Content>
		</Sheet>
	);
}
