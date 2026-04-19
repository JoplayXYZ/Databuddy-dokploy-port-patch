"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { GlobeSimple } from "@phosphor-icons/react";
import { SlackLogo } from "@phosphor-icons/react";
import { X } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/lib/orpc";

type DestType = "slack" | "email" | "webhook";

const CHANNELS: Record<
	DestType,
	{
		label: string;
		icon: React.ElementType;
		fieldLabel: string;
		placeholder: string;
	}
> = {
	slack: {
		label: "Slack",
		icon: SlackLogo,
		fieldLabel: "Webhook URL",
		placeholder: "https://hooks.slack.com/services/...",
	},
	email: {
		label: "Email",
		icon: EnvelopeSimple,
		fieldLabel: "Email address",
		placeholder: "alerts@example.com",
	},
	webhook: {
		label: "Webhook",
		icon: GlobeSimple,
		fieldLabel: "Endpoint URL",
		placeholder: "https://api.example.com/webhooks/...",
	},
};

const destinationSchema = z.object({
	type: z.enum(["slack", "email", "webhook"]),
	identifier: z.string().min(1, "Required"),
	config: z.record(z.string(), z.unknown()),
});

const alarmFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	enabled: z.boolean(),
	destinations: z
		.array(destinationSchema)
		.min(1, "At least one destination is required"),
});

type AlarmFormData = z.infer<typeof alarmFormSchema>;

interface AlarmDestination {
	config: Record<string, unknown>;
	id: string;
	identifier: string;
	type: string;
}

export interface AlarmData {
	description?: string | null;
	destinations?: AlarmDestination[];
	enabled: boolean;
	id: string;
	name: string;
	triggerConditions?: Record<string, unknown>;
	triggerType: string;
	websiteId?: string | null;
}

interface AlarmSheetProps {
	alarm?: AlarmData | null;
	onCloseAction: (open: boolean) => void;
	onSaveAction?: () => void;
	open: boolean;
}

function buildDefaults(alarm: AlarmData | null | undefined): AlarmFormData {
	return {
		name: alarm?.name ?? "",
		description: alarm?.description ?? "",
		enabled: alarm?.enabled ?? true,
		destinations: alarm?.destinations?.map((d) => ({
			type: d.type as DestType,
			identifier: d.identifier ?? "",
			config: (d.config ?? {}) as Record<string, unknown>,
		})) ?? [{ type: "slack" as DestType, identifier: "", config: {} }],
	};
}

export function AlarmSheet({
	open,
	onCloseAction,
	onSaveAction,
	alarm,
}: AlarmSheetProps) {
	const isEditing = !!alarm;
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();
	const queryClient = useQueryClient();

	const form = useForm<AlarmFormData>({
		resolver: zodResolver(alarmFormSchema),
		defaultValues: buildDefaults(alarm),
	});

	useEffect(() => {
		if (open) {
			form.reset(buildDefaults(alarm));
		}
	}, [open, alarm, form.reset]);

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "destinations",
	});

	const createMutation = useMutation({
		...orpc.alarms.create.mutationOptions(),
	});
	const updateMutation = useMutation({
		...orpc.alarms.update.mutationOptions(),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleSubmit = async (data: AlarmFormData) => {
		const organizationId =
			activeOrganization?.id ?? activeOrganizationId ?? null;
		if (!organizationId) {
			return;
		}

		try {
			if (isEditing && alarm) {
				await updateMutation.mutateAsync({
					alarmId: alarm.id,
					name: data.name,
					description: data.description ?? null,
					enabled: data.enabled,
					websiteId: alarm.websiteId ?? null,
					triggerType: alarm.triggerType as
						| "uptime"
						| "traffic_spike"
						| "error_rate"
						| "goal"
						| "custom",
					destinations: data.destinations,
				});
				toast.success("Alert updated");
			} else {
				await createMutation.mutateAsync({
					organizationId,
					name: data.name,
					description: data.description,
					enabled: data.enabled,
					triggerType: "uptime",
					triggerConditions: {},
					destinations: data.destinations,
				});
				toast.success("Alert created");
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.alarms.list.key(),
			});
			onSaveAction?.();
			onCloseAction(false);
		} catch {
			// error toast handled by global handler
		}
	};

	const addDestination = (type: DestType) => {
		append({ type, identifier: "", config: {} });
	};

	return (
		<Sheet onOpenChange={onCloseAction} open={open}>
			<SheetContent className="w-full sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{isEditing ? "Edit Alert" : "New Alert"}</SheetTitle>
					<SheetDescription>
						{isEditing
							? "Update this alert's destinations and settings."
							: "Configure where notifications are sent. Attach this alert to monitors and rules later."}
					</SheetDescription>
				</SheetHeader>

				<Form {...form}>
					<form
						className="flex flex-1 flex-col overflow-hidden"
						onSubmit={form.handleSubmit(handleSubmit)}
					>
						<SheetBody className="space-y-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. Production Slack, Oncall webhook"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											Description{" "}
											<span className="text-muted-foreground">(optional)</span>
										</FormLabel>
										<FormControl>
											<Input
												placeholder="Team notes about this alert"
												{...field}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{isEditing && (
								<FormField
									control={form.control}
									name="enabled"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-lg border p-3">
											<div>
												<FormLabel className="font-normal text-sm">
													Enabled
												</FormLabel>
												<p className="text-muted-foreground text-xs">
													Paused alerts won't fire even when triggered
												</p>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							)}

							<div className="h-px bg-border" />

							<div className="space-y-3">
								<p className="font-medium text-sm">Destinations</p>

								{form.formState.errors.destinations?.root && (
									<p className="text-destructive text-xs">
										{form.formState.errors.destinations.root.message}
									</p>
								)}

								<div className="space-y-2">
									{fields.map((field, index) => {
										const destType = form.watch(
											`destinations.${index}.type`
										) as DestType;
										const channel = CHANNELS[destType];
										const Icon = channel?.icon ?? GlobeSimple;

										return (
											<div className="rounded-lg border" key={field.id}>
												<div className="flex items-center justify-between border-b px-3 py-2">
													<div className="flex items-center gap-2">
														<Icon
															className="size-4 text-muted-foreground"
															weight="duotone"
														/>
														<span className="font-medium text-sm">
															{channel?.label ?? destType}
														</span>
													</div>
													{fields.length > 1 && (
														<button
															aria-label="Remove destination"
															className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
															onClick={() => remove(index)}
															type="button"
														>
															<X className="size-3.5" />
														</button>
													)}
												</div>

												<div className="space-y-3 p-3">
													<FormField
														control={form.control}
														name={`destinations.${index}.identifier`}
														render={({ field: idField }) => (
															<FormItem className="space-y-1.5">
																<FormLabel className="text-xs">
																	{channel?.fieldLabel ?? "Identifier"}
																</FormLabel>
																<FormControl>
																	<Input
																		className="h-9"
																		placeholder={channel?.placeholder ?? ""}
																		{...idField}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													{destType === "webhook" && (
														<FormItem className="space-y-1.5">
															<FormLabel className="text-xs">
																Custom headers{" "}
																<span className="text-muted-foreground">
																	(optional)
																</span>
															</FormLabel>
															<Input
																className="h-9 font-mono text-xs"
																onChange={(e) => {
																	try {
																		const parsed = JSON.parse(e.target.value);
																		form.setValue(
																			`destinations.${index}.config`,
																			{
																				...form.getValues(
																					`destinations.${index}.config`
																				),
																				headers: parsed,
																			}
																		);
																	} catch {
																		// allow typing
																	}
																}}
																placeholder='{"Authorization": "Bearer ..."}'
																value={
																	form.watch(`destinations.${index}.config`)
																		?.headers
																		? JSON.stringify(
																				form.watch(
																					`destinations.${index}.config`
																				)?.headers
																			)
																		: ""
																}
															/>
														</FormItem>
													)}
												</div>
											</div>
										);
									})}
								</div>

								<div className="flex gap-2">
									{(
										Object.entries(CHANNELS) as [
											DestType,
											(typeof CHANNELS)[DestType],
										][]
									).map(([type, config]) => {
										const Icon = config.icon;
										return (
											<Button
												className="gap-1.5"
												key={type}
												onClick={() => addDestination(type)}
												size="sm"
												type="button"
												variant="outline"
											>
												<Icon className="size-3.5" weight="duotone" />
												{config.label}
											</Button>
										);
									})}
								</div>
							</div>
						</SheetBody>

						<SheetFooter>
							<Button
								onClick={() => onCloseAction(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="min-w-28"
								disabled={isPending || !form.formState.isValid}
								type="submit"
							>
								{isPending
									? "Saving..."
									: isEditing
										? "Save Changes"
										: "Create Alert"}
							</Button>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	);
}
