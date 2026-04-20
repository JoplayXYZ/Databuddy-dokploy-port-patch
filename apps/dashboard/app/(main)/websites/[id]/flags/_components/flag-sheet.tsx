"use client";

import type { FlagWithScheduleForm } from "@databuddy/shared/flags";
import { flagWithScheduleSchema } from "@databuddy/shared/flags";
import { zodResolver } from "@hookform/resolvers/zod";
import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import { CodeIcon } from "@phosphor-icons/react/dist/ssr";
import { FlagIcon } from "@phosphor-icons/react/dist/ssr";
import { GitBranchIcon } from "@phosphor-icons/react/dist/ssr";
import { UserIcon } from "@phosphor-icons/react/dist/ssr";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	CodeBlock,
	CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { Button } from "@/components/ds/button";
import { Divider } from "@/components/ds/divider";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { LineSlider } from "@/components/ds/line-slider";
import { Sheet } from "@/components/ds/sheet";
import { Switch } from "@/components/ds/switch";
import { Textarea } from "@/components/ds/textarea";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { GroupSelector } from "../groups/_components/group-selector";
import { DependencySelector } from "./dependency-selector";
import type { Flag, FlagSheetProps, TargetGroup } from "./types";
import { UserRulesBuilder } from "./user-rules-builder";
import { VariantEditor } from "./variant-editor";

type ExpandedSection =
	| "targeting"
	| "groups"
	| "dependencies"
	| "implementation"
	| null;

function CollapsibleSection({
	icon: Icon,
	title,
	badge,
	isExpanded,
	onToggleAction,
	children,
}: {
	badge?: number;
	children: React.ReactNode;
	icon: React.ComponentType<{
		className?: string;
		weight?: "duotone" | "fill";
	}>;
	isExpanded: boolean;
	onToggleAction: () => void;
	title: string;
}) {
	return (
		<div>
			<button
				className="group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-interactive-hover"
				onClick={onToggleAction}
				type="button"
			>
				<div className="flex items-center gap-2">
					<Icon
						className={cn(
							"size-4 transition-colors",
							isExpanded ? "text-primary" : "text-muted-foreground"
						)}
						weight={isExpanded ? "fill" : "duotone"}
					/>
					<span className="font-medium text-foreground text-xs">{title}</span>
					{badge !== undefined && badge > 0 && (
						<span className="flex size-4 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground tabular-nums">
							{badge}
						</span>
					)}
				</div>
				<CaretDownIcon
					className={cn(
						"size-3.5 text-muted-foreground transition-transform duration-200",
						isExpanded && "rotate-180"
					)}
					weight="fill"
				/>
			</button>

			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						animate={{ height: "auto", opacity: 1 }}
						className="overflow-hidden"
						exit={{ height: 0, opacity: 0 }}
						initial={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
					>
						<div className="px-1 pt-1 pb-2">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function ImplementationExamples({
	flagKey,
	flagType,
}: {
	flagKey: string;
	flagType: "boolean" | "rollout" | "multivariant";
}) {
	const codeExamples = useMemo(() => {
		const safeKey = flagKey || "my-feature";

		const basicExample = `import { useFlag } from '@databuddy/sdk/react';

function MyComponent() {
  const { on, loading } = useFlag('${safeKey}');

  if (loading) return <Skeleton />;
  return on ? <NewFeature /> : <OldFeature />;
}`;

		const ssrExample = `import { useFlag } from '@databuddy/sdk/react';

function MyComponent() {
  const { on, loading } = useFlag('${safeKey}');

  if (loading) return <FallbackUI />;
  return on ? <NewFeature /> : <OldFeature />;
}`;

		const variantExample = `import { useFlag } from '@databuddy/sdk/react';

function MyComponent() {
  const { variant } = useFlag('${safeKey}');

  switch (variant) {
    case 'control':
      return <ControlVersion />;
    case 'variant-a':
      return <VariantA />;
    case 'variant-b':
      return <VariantB />;
    default:
      return <DefaultVersion />;
  }
}`;

		if (flagType === "multivariant") {
			return [
				{ title: "A/B Test Variants", code: variantExample },
				{ title: "Simple Boolean Check", code: basicExample },
			];
		}

		return [
			{ title: "Basic Usage", code: basicExample },
			{ title: "SSR-Safe with Default", code: ssrExample },
		];
	}, [flagKey, flagType]);

	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-xs">
				Use the Databuddy SDK to check this flag in your app.
			</p>
			{codeExamples.map((example) => (
				<div className="space-y-1.5" key={example.title}>
					<span className="font-medium text-foreground text-xs">
						{example.title}
					</span>
					<CodeBlock
						className="text-xs [&>div>div>pre]:p-3 [&_code]:text-xs"
						code={example.code}
						language="tsx"
					>
						<CodeBlockCopyButton />
					</CodeBlock>
				</div>
			))}
			<p className="text-muted-foreground text-xs">
				Install:{" "}
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
					bun add @databuddy/sdk
				</code>
			</p>
		</div>
	);
}

function OptionCard({
	selected,
	onClick,
	label,
	description,
	disabled,
	className,
}: {
	className?: string;
	description?: string;
	disabled?: boolean;
	label: string;
	onClick: () => void;
	selected: boolean;
}) {
	return (
		<button
			className={cn(
				"flex-1 cursor-pointer rounded-md border py-2 text-center transition-all",
				selected
					? "border-primary/40 bg-primary/5 text-foreground ring-1 ring-primary/20"
					: "border-border/60 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
				disabled && "cursor-not-allowed opacity-40",
				className
			)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<span className="block font-medium text-xs capitalize">{label}</span>
			{description && (
				<span
					className={cn(
						"block text-[10px]",
						selected ? "text-primary/70" : "text-muted-foreground"
					)}
				>
					{description}
				</span>
			)}
		</button>
	);
}

export function FlagSheet({
	isOpen,
	onCloseAction,
	websiteId,
	flag,
	template,
}: FlagSheetProps) {
	const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
	const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
	const queryClient = useQueryClient();

	const { data: flagsListRaw } = useQuery({
		...orpc.flags.list.queryOptions({
			input: { websiteId },
		}),
	});
	const flagsList = flagsListRaw as Flag[] | undefined;

	const { data: targetGroupsRaw } = useQuery({
		...orpc.targetGroups.list.queryOptions({
			input: { websiteId },
		}),
	});
	const targetGroups = targetGroupsRaw as TargetGroup[] | undefined;

	const isEditing = Boolean(flag);

	const form = useForm<FlagWithScheduleForm>({
		resolver: zodResolver(flagWithScheduleSchema),
		defaultValues: {
			flag: {
				key: "",
				name: "",
				description: "",
				type: "boolean",
				status: "active",
				defaultValue: false,
				rolloutPercentage: 0,
				rolloutBy: undefined,
				rules: [],
				variants: [],
				dependencies: [],
				environment: undefined,
				targetGroupIds: [],
			},
			schedule: undefined,
		},
	});

	const createMutation = useMutation({
		...orpc.flags.create.mutationOptions(),
	});
	const updateMutation = useMutation({
		...orpc.flags.update.mutationOptions(),
	});

	const resetForm = useCallback(() => {
		if (flag && isEditing) {
			const extractTargetGroupIds = (): string[] => {
				if (flag.targetGroupIds && Array.isArray(flag.targetGroupIds)) {
					return flag.targetGroupIds;
				}
				if (flag.targetGroups && Array.isArray(flag.targetGroups)) {
					return flag.targetGroups.map((g) =>
						typeof g === "string" ? g : g.id
					);
				}
				return [];
			};

			form.reset({
				flag: {
					key: flag.key,
					name: flag.name || "",
					description: flag.description || "",
					type: flag.type,
					status: flag.status,
					defaultValue: Boolean(flag.defaultValue),
					rolloutPercentage: flag.rolloutPercentage ?? 0,
					rolloutBy: flag.rolloutBy || undefined,
					rules: flag.rules ?? [],
					variants: flag.variants ?? [],
					dependencies: flag.dependencies ?? [],
					environment: flag.environment || undefined,
					targetGroupIds: extractTargetGroupIds(),
				},
				schedule: undefined,
			});
		} else if (template) {
			form.reset({
				flag: {
					key: template.id,
					name: template.name,
					description: template.description,
					type: template.type,
					status: "active",
					defaultValue: template.defaultValue,
					rolloutPercentage:
						template.type === "rollout" || template.type === "boolean"
							? (template.rolloutPercentage ?? 0)
							: 0,
					rolloutBy: undefined,
					rules: template.rules ?? [],
					variants: template.type === "multivariant" ? template.variants : [],
					dependencies: [],
					targetGroupIds: [],
				},
				schedule: undefined,
			});
			if (template.rules && template.rules.length > 0) {
				setExpandedSection("targeting");
			}
		} else {
			form.reset({
				flag: {
					key: "",
					name: "",
					description: "",
					type: "boolean",
					status: "active",
					defaultValue: false,
					rolloutPercentage: 0,
					rolloutBy: undefined,
					rules: [],
					variants: [],
					dependencies: [],
					targetGroupIds: [],
				},
				schedule: undefined,
			});
		}
		setKeyManuallyEdited(false);
		if (!template) {
			setExpandedSection(null);
		}
	}, [flag, isEditing, form, template]);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onCloseAction();
		}
	};

	useEffect(() => {
		if (isOpen) {
			resetForm();
		}
	}, [flag?.id, template?.id, isOpen]);

	const watchedType = form.watch("flag.type");
	const watchedRules = form.watch("flag.rules") || [];
	const watchedDependencies = form.watch("flag.dependencies") || [];

	const handleNameChange = (value: string) => {
		form.setValue("flag.name", value);

		const canAutoGenerate = !(isEditing || keyManuallyEdited) && value;
		if (canAutoGenerate) {
			const key = value
				.toLowerCase()
				.replace(/[^a-z0-9\s]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 50);
			form.setValue("flag.key", key);
		}
	};

	const toggleSection = (section: ExpandedSection) => {
		setExpandedSection((prev) => (prev === section ? null : section));
	};

	const onSubmit = async (formData: FlagWithScheduleForm) => {
		try {
			const data = formData.flag;

			if (isEditing && flag) {
				await updateMutation.mutateAsync({
					id: flag.id,
					name: data.name,
					description: data.description,
					type: data.type,
					status: data.status,
					rules: data.rules || [],
					variants: data.variants || [],
					dependencies: data.dependencies || [],
					environment: data.environment?.trim() || undefined,
					defaultValue: data.defaultValue,
					rolloutPercentage: data.rolloutPercentage ?? 0,
					rolloutBy: data.rolloutBy || undefined,
					targetGroupIds: data.targetGroupIds || [],
				});
			} else {
				await createMutation.mutateAsync({
					websiteId,
					key: data.key,
					name: data.name,
					description: data.description,
					type: data.type,
					status: data.status,
					rules: data.rules || [],
					variants: data.variants || [],
					dependencies: data.dependencies || [],
					environment: data.environment?.trim() || undefined,
					defaultValue: data.defaultValue,
					rolloutPercentage: data.rolloutPercentage ?? 0,
					rolloutBy: data.rolloutBy || undefined,
					targetGroupIds: data.targetGroupIds || [],
				});
			}

			toast.success(`Flag ${isEditing ? "updated" : "created"} successfully`);

			queryClient.invalidateQueries({
				queryKey: orpc.flags.list.key({ input: { websiteId } }),
			});

			onCloseAction();
		} catch (error) {
			console.error("Flag mutation error:", error);
		}
	};

	const isLoading = createMutation.isPending || updateMutation.isPending;
	const isRollout = watchedType === "rollout";
	const isMultivariant = watchedType === "multivariant";

	return (
		<Sheet onOpenChange={handleOpenChange} open={isOpen}>
			<Sheet.Content className="sm:max-w-xl" side="right">
				<Sheet.Header>
					<div className="flex items-center gap-4">
						<div className="flex size-11 items-center justify-center rounded border bg-secondary">
							<FlagIcon className="size-5 text-primary" weight="fill" />
						</div>
						<div>
							<Sheet.Title className="text-lg">
								{isEditing
									? "Edit Flag"
									: template
										? `Create from ${template.name}`
										: "Create Flag"}
							</Sheet.Title>
							<Sheet.Description>
								{isEditing
									? `Editing ${flag?.name || flag?.key}`
									: template
										? "Pre-configured with template settings"
										: "Set up a new feature flag"}
							</Sheet.Description>
						</div>
					</div>
				</Sheet.Header>

				<form
					className="flex flex-1 flex-col overflow-hidden"
					onSubmit={form.handleSubmit(onSubmit, (errors) => {
						console.error("Validation errors:", errors);
						const firstError = Object.values(errors)[0];
						if (firstError?.message) {
							toast.error(`Validation error: ${firstError.message}`);
						} else {
							toast.error("Please fix the form errors");
						}
					})}
				>
					<Sheet.Body className="space-y-5">
						{/* Identity */}
						<div className="grid gap-3 sm:grid-cols-2">
							<Controller
								control={form.control}
								name="flag.name"
								render={({ field, fieldState }) => (
									<Field error={!!fieldState.error}>
										<Field.Label>Name</Field.Label>
										<Input
											placeholder="New Feature…"
											{...field}
											onChange={(e) => handleNameChange(e.target.value)}
										/>
										{fieldState.error && (
											<Field.Error>{fieldState.error.message}</Field.Error>
										)}
									</Field>
								)}
							/>

							<Controller
								control={form.control}
								name="flag.key"
								render={({ field, fieldState }) => (
									<Field error={!!fieldState.error}>
										<Field.Label>
											Key
											{!isEditing && (
												<span className="ml-1 text-destructive">*</span>
											)}
										</Field.Label>
										<Input
											className={cn(isEditing && "bg-muted")}
											disabled={isEditing}
											placeholder="new-feature"
											{...field}
											onChange={(e) => {
												setKeyManuallyEdited(true);
												field.onChange(e);
											}}
										/>
										{fieldState.error && (
											<Field.Error>{fieldState.error.message}</Field.Error>
										)}
									</Field>
								)}
							/>
						</div>

						<Controller
							control={form.control}
							name="flag.description"
							render={({ field, fieldState }) => (
								<Field error={!!fieldState.error}>
									<Field.Label className="text-muted-foreground">
										Description
									</Field.Label>
									<Textarea
										className="min-h-16 resize-none"
										placeholder="What does this flag control?…"
										{...field}
									/>
									{fieldState.error && (
										<Field.Error>{fieldState.error.message}</Field.Error>
									)}
								</Field>
							)}
						/>

						<Divider />

						{/* Type */}
						<div className="space-y-2">
							<Field.Label>Type</Field.Label>
							<div className="flex gap-2">
								{(["boolean", "rollout", "multivariant"] as const).map(
									(type) => (
										<OptionCard
											description={
												{
													boolean: "On or Off",
													rollout: "% of users",
													multivariant: "A/B variants",
												}[type]
											}
											key={type}
											label={type}
											onClick={() => form.setValue("flag.type", type)}
											selected={watchedType === type}
										/>
									)
								)}
							</div>
						</div>

						{/* Type-specific config */}
						<AnimatePresence mode="wait">
							{isRollout ? (
								<motion.div
									animate={{ opacity: 1, y: 0 }}
									className="space-y-3"
									exit={{ opacity: 0, y: -8 }}
									initial={{ opacity: 0, y: 8 }}
									key="rollout"
									transition={{ duration: 0.15 }}
								>
									<Controller
										control={form.control}
										name="flag.rolloutPercentage"
										render={({ field }) => (
											<div className="space-y-2">
												<div className="flex items-baseline justify-between">
													<Field.Label>Rollout</Field.Label>
													<span className="font-mono text-foreground text-sm tabular-nums">
														{field.value}%
													</span>
												</div>
												<LineSlider
													aria-label="Rollout percentage"
													max={100}
													min={0}
													onValueChange={field.onChange}
													value={Number(field.value) || 0}
												/>
												<div className="flex gap-1">
													{[0, 25, 50, 75, 100].map((preset) => (
														<button
															className={cn(
																"flex-1 cursor-pointer rounded-md border py-1 font-medium text-[10px] tabular-nums transition-all",
																Number(field.value) === preset
																	? "border-primary/40 bg-primary text-primary-foreground"
																	: "border-border/60 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
															)}
															key={preset}
															onClick={() => field.onChange(preset)}
															type="button"
														>
															{preset}%
														</button>
													))}
												</div>
											</div>
										)}
									/>

									<Controller
										control={form.control}
										name="flag.rolloutBy"
										render={({ field }) => {
											const rolloutByValue = field.value || "user";
											const options = [
												{
													value: "user",
													label: "User",
													icon: UserIcon,
												},
												{
													value: "organization",
													label: "Org",
													icon: BuildingsIcon,
												},
												{
													value: "team",
													label: "Team",
													icon: UsersThreeIcon,
												},
											] as const;

											return (
												<div className="space-y-2">
													<Field.Label>Bucket by</Field.Label>
													<div className="flex gap-2">
														{options.map((option) => {
															const isSelected =
																rolloutByValue === option.value;
															const Icon = option.icon;
															return (
																<button
																	className={cn(
																		"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-2 transition-all",
																		isSelected
																			? "border-primary/40 bg-primary/5 text-foreground ring-1 ring-primary/20"
																			: "border-border/60 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
																	)}
																	key={option.value}
																	onClick={() => field.onChange(option.value)}
																	type="button"
																>
																	<Icon
																		className={cn(
																			"size-3.5",
																			isSelected
																				? "text-primary"
																				: "text-muted-foreground"
																		)}
																		weight="duotone"
																	/>
																	<span className="font-medium text-xs">
																		{option.label}
																	</span>
																</button>
															);
														})}
													</div>
												</div>
											);
										}}
									/>
								</motion.div>
							) : isMultivariant ? (
								<motion.div
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -8 }}
									initial={{ opacity: 0, y: 8 }}
									key="multivariant"
									transition={{ duration: 0.15 }}
								>
									<Controller
										control={form.control}
										name="flag.variants"
										render={({ field }) => (
											<VariantEditor
												onChangeAction={field.onChange}
												variants={field.value || []}
											/>
										)}
									/>
								</motion.div>
							) : (
								<motion.div
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -8 }}
									initial={{ opacity: 0, y: 8 }}
									key="boolean"
									transition={{ duration: 0.15 }}
								>
									<div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary px-3 py-2.5">
										<Field.Label>Default value</Field.Label>
										<Controller
											control={form.control}
											name="flag.defaultValue"
											render={({ field }) => (
												<div className="flex items-center gap-2">
													<span
														className={cn(
															"text-xs transition-colors",
															field.value
																? "text-muted-foreground/50"
																: "font-medium text-foreground"
														)}
													>
														Off
													</span>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
													<span
														className={cn(
															"text-xs transition-colors",
															field.value
																? "font-medium text-foreground"
																: "text-muted-foreground/50"
														)}
													>
														On
													</span>
												</div>
											)}
										/>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						{/* Status */}
						<Controller
							control={form.control}
							name="flag.status"
							render={({ field }) => {
								const inactiveDeps = (flagsList || []).filter(
									(f) =>
										watchedDependencies.includes(f.key) && f.status !== "active"
								);
								const canBeActive = inactiveDeps.length === 0;

								return (
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Field.Label>Status</Field.Label>
											{!canBeActive && (
												<span className="text-[10px] text-warning">
													Dependencies must be active first
												</span>
											)}
										</div>
										<div className="flex gap-2">
											{(["active", "inactive", "archived"] as const).map(
												(status) => {
													const isDisabled =
														status === "active" && !canBeActive;
													const isSelected = field.value === status;
													const colorClass = isSelected
														? status === "active"
															? "border-success/40 bg-success/5 text-success ring-1 ring-success/20"
															: status === "inactive"
																? "border-destructive/40 bg-destructive/5 text-destructive ring-1 ring-destructive/20"
																: "border-warning/40 bg-warning/5 text-warning ring-1 ring-warning/20"
														: "border-border/60 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground";

													return (
														<OptionCard
															className={isSelected ? colorClass : undefined}
															description={
																{
																	active: "Live",
																	inactive: "Returns false",
																	archived: "Hidden",
																}[status]
															}
															disabled={isDisabled}
															key={status}
															label={status}
															onClick={() => field.onChange(status)}
															selected={isSelected}
														/>
													);
												}
											)}
										</div>
									</div>
								);
							}}
						/>

						<Divider />

						{/* Advanced sections */}
						<div className="-mx-1 space-y-0.5">
							<CollapsibleSection
								badge={form.watch("flag.targetGroupIds")?.length ?? 0}
								icon={UsersThreeIcon}
								isExpanded={expandedSection === "groups"}
								onToggleAction={() => toggleSection("groups")}
								title="Target Groups"
							>
								<Controller
									control={form.control}
									name="flag.targetGroupIds"
									render={({ field }) => (
										<GroupSelector
											availableGroups={targetGroups ?? []}
											onChangeAction={(ids) => field.onChange(ids)}
											selectedGroups={field.value ?? []}
										/>
									)}
								/>
							</CollapsibleSection>

							<CollapsibleSection
								badge={watchedRules.length}
								icon={UsersIcon}
								isExpanded={expandedSection === "targeting"}
								onToggleAction={() => toggleSection("targeting")}
								title="User Targeting"
							>
								<Controller
									control={form.control}
									name="flag.rules"
									render={({ field }) => (
										<UserRulesBuilder
											onChange={field.onChange}
											rules={field.value || []}
										/>
									)}
								/>
							</CollapsibleSection>

							<CollapsibleSection
								badge={watchedDependencies.length}
								icon={GitBranchIcon}
								isExpanded={expandedSection === "dependencies"}
								onToggleAction={() => toggleSection("dependencies")}
								title="Dependencies"
							>
								<Controller
									control={form.control}
									name="flag.dependencies"
									render={({ field }) => (
										<DependencySelector
											availableFlags={flagsList ?? []}
											currentFlagKey={flag?.key}
											onChange={field.onChange}
											value={field.value || []}
										/>
									)}
								/>
							</CollapsibleSection>

							<CollapsibleSection
								icon={CodeIcon}
								isExpanded={expandedSection === "implementation"}
								onToggleAction={() => toggleSection("implementation")}
								title="Code"
							>
								<ImplementationExamples
									flagKey={form.watch("flag.key") || "my-feature"}
									flagType={watchedType}
								/>
							</CollapsibleSection>
						</div>
					</Sheet.Body>

					<Sheet.Footer>
						<Button onClick={onCloseAction} type="button" variant="secondary">
							Cancel
						</Button>
						<Button className="min-w-28" loading={isLoading} type="submit">
							{isEditing ? "Save Changes" : "Create Flag"}
						</Button>
					</Sheet.Footer>
				</form>
				<Sheet.Close />
			</Sheet.Content>
		</Sheet>
	);
}
