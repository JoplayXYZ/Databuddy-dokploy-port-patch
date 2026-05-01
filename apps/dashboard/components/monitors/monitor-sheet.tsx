"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { useWebsite } from "@/hooks/use-websites";
import { orpc } from "@/lib/orpc";
import { BellIcon, InfoIcon } from "@databuddy/ui/icons";
import { Sheet, Switch } from "@databuddy/ui/client";
import {
	Badge,
	Button,
	Divider,
	Field,
	Input,
	SegmentedControl,
	Text,
	Tooltip,
} from "@databuddy/ui";

type GranularityValue =
	| "minute"
	| "five_minutes"
	| "ten_minutes"
	| "thirty_minutes"
	| "hour"
	| "six_hours";

const granularityOptions: { label: string; value: GranularityValue }[] = [
	{ value: "minute", label: "1m" },
	{ value: "five_minutes", label: "5m" },
	{ value: "ten_minutes", label: "10m" },
	{ value: "thirty_minutes", label: "30m" },
	{ value: "hour", label: "1h" },
	{ value: "six_hours", label: "6h" },
];

const DEST_LABELS: Record<string, string> = {
	slack: "Slack",
	email: "Email",
	webhook: "Webhook",
};

interface MonitorSheetProps {
	onCloseAction: (open: boolean) => void;
	onCreatedAction?: (scheduleId: string) => void;
	onSaveAction?: () => void;
	open: boolean;
	schedule?: {
		cacheBust?: boolean;
		granularity: string;
		id: string;
		jsonParsingConfig?: {
			enabled: boolean;
		} | null;
		name?: string | null;
		timeout?: number | null;
		url: string;
	} | null;
	websiteId?: string;
}

function SettingsRow({
	label,
	description,
	children,
}: {
	children: React.ReactNode;
	description?: string;
	label: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{label}</p>
				{description && (
					<p className="text-muted-foreground text-xs">{description}</p>
				)}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

function isValidUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

interface ParsedAlarm {
	destinations: Array<{ id: string; type: string }>;
	enabled: boolean;
	id: string;
	linkedIds: string[];
	name: string;
	triggerConditions: Record<string, unknown>;
}

function parseAlarms(
	rows: readonly Record<string, unknown>[],
): ParsedAlarm[] {
	return rows.map((row) => {
		const r = row as Record<string, unknown>;
		const tc =
			typeof r.triggerConditions === "object" && r.triggerConditions
				? (r.triggerConditions as Record<string, unknown>)
				: {};
		return {
			id: r.id as string,
			name: r.name as string,
			enabled: r.enabled as boolean,
			triggerConditions: tc,
			linkedIds: Array.isArray(tc.monitorIds)
				? (tc.monitorIds as string[])
				: [],
			destinations: Array.isArray(r.destinations)
				? (r.destinations as Array<{ id: string; type: string }>)
				: [],
		};
	});
}

function AlarmRow({
	alarm,
	isLinked,
	onToggle,
	isPending,
}: {
	alarm: ParsedAlarm;
	isLinked: boolean;
	isPending: boolean;
	onToggle: () => void;
}) {
	const destSummary = alarm.destinations
		.map((d) => DEST_LABELS[d.type] ?? d.type)
		.join(", ");

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<p className="truncate font-medium text-sm">{alarm.name}</p>
					{!alarm.enabled && (
						<Badge size="sm" variant="muted">
							Paused
						</Badge>
					)}
				</div>
				{destSummary && (
					<p className="truncate text-muted-foreground text-xs">
						{destSummary}
					</p>
				)}
			</div>
			<div className="shrink-0">
				<Switch
					checked={isLinked}
					disabled={isPending}
					onCheckedChange={onToggle}
				/>
			</div>
		</div>
	);
}

export function MonitorSheet({
	open,
	onCloseAction,
	websiteId,
	onSaveAction,
	onCreatedAction,
	schedule,
}: MonitorSheetProps) {
	const isEditing = !!schedule;
	const { data: website } = useWebsite(websiteId || "");
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();
	const queryClient = useQueryClient();

	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [granularity, setGranularity] =
		useState<GranularityValue>("ten_minutes");
	const [timeoutMs, setTimeoutMs] = useState<number | null>(null);
	const [cacheBust, setCacheBust] = useState(false);
	const [jsonParsingEnabled, setJsonParsingEnabled] = useState(true);
	const [urlError, setUrlError] = useState<string | null>(null);

	const createMutation = useMutation({
		...orpc.uptime.createSchedule.mutationOptions(),
	});
	const updateMutation = useMutation({
		...orpc.uptime.updateSchedule.mutationOptions(),
	});
	const alarmUpdateMutation = useMutation({
		...orpc.alarms.update.mutationOptions(),
	});

	const { data: rawAlarms } = useQuery({
		...orpc.alarms.list.queryOptions({ input: {} }),
		enabled: open && isEditing,
	});

	const alarms = parseAlarms(
		(rawAlarms ?? []) as readonly Record<string, unknown>[],
	);

	const toggleAlarm = async (alarm: ParsedAlarm) => {
		const isLinked = alarm.linkedIds.includes(schedule!.id);
		const nextIds = isLinked
			? alarm.linkedIds.filter((id) => id !== schedule!.id)
			: [...alarm.linkedIds, schedule!.id];
		try {
			await alarmUpdateMutation.mutateAsync({
				alarmId: alarm.id,
				triggerConditions: {
					...alarm.triggerConditions,
					monitorIds: nextIds,
				},
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.alarms.list.key(),
			});
		} catch {
			toast.error("Failed to update alert");
		}
	};

	useEffect(() => {
		if (!open) {
			return;
		}

		let initialUrl = schedule?.url ?? "";
		const siteDomain = website?.domain ?? "";
		if (!(isEditing || initialUrl) && siteDomain) {
			initialUrl = siteDomain.startsWith("http")
				? siteDomain
				: `https://${siteDomain}`;
		}

		let initialName = schedule?.name ?? "";
		if (!(isEditing || initialName) && website?.name) {
			initialName = website.name;
		}

		setName(initialName);
		setUrl(initialUrl);
		setGranularity(
			(schedule?.granularity as GranularityValue) ?? "ten_minutes",
		);
		setTimeoutMs(schedule?.timeout ?? null);
		setCacheBust(schedule?.cacheBust ?? false);
		setJsonParsingEnabled(schedule?.jsonParsingConfig?.enabled ?? true);
		setUrlError(null);
	}, [open, schedule, website, isEditing]);

	const isPending = createMutation.isPending || updateMutation.isPending;

	const validateUrl = useCallback(() => {
		if (!url) {
			setUrlError(null);
			return;
		}
		setUrlError(
			isValidUrl(url)
				? null
				: "Please enter a valid URL (e.g. https://example.com)",
		);
	}, [url]);

	const canSubmit =
		isEditing || (url.length > 0 && !urlError && isValidUrl(url));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!(isEditing || (url && isValidUrl(url)))) {
			setUrlError("Please enter a valid URL (e.g. https://example.com)");
			return;
		}

		const jsonParsingConfig = { enabled: jsonParsingEnabled };

		try {
			if (isEditing && schedule) {
				await updateMutation.mutateAsync({
					scheduleId: schedule.id,
					name: name.trim() || null,
					granularity,
					timeout: timeoutMs,
					cacheBust,
					jsonParsingConfig,
				});
				toast.success("Monitor updated");
			} else {
				const resolvedOrganizationId =
					activeOrganization?.id ?? activeOrganizationId ?? null;
				const result = await createMutation.mutateAsync({
					...(resolvedOrganizationId
						? { organizationId: resolvedOrganizationId }
						: {}),
					websiteId,
					url,
					name: name.trim() || undefined,
					granularity,
					timeout: timeoutMs ?? undefined,
					cacheBust,
					jsonParsingConfig,
				});
				toast.success("Monitor created");
				onCreatedAction?.(result.scheduleId as string);
			}
			onSaveAction?.();
			onCloseAction(false);
		} catch {
		}
	};

	return (
		<Sheet onOpenChange={onCloseAction} open={open}>
			<Sheet.Content className="w-full sm:max-w-md">
				<Sheet.Close />
				<Sheet.Header>
					<Sheet.Title>
						{isEditing ? "Edit Monitor" : "Create Monitor"}
					</Sheet.Title>
					<Sheet.Description>
						{isEditing
							? "Update your uptime monitor settings"
							: "Set up a new uptime monitor"}
					</Sheet.Description>
				</Sheet.Header>

				<form
					className="flex flex-1 flex-col overflow-hidden"
					onSubmit={handleSubmit}
				>
					<Sheet.Body className="space-y-5">
						<div className="space-y-4">
							<Field>
								<Field.Label>Name</Field.Label>
								<Input
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. Production API"
									value={name}
								/>
								<Field.Description>Optional display name</Field.Description>
							</Field>

							<Field error={!!urlError}>
								<Field.Label>URL</Field.Label>
								<Input
									disabled={isEditing}
									onBlur={validateUrl}
									onChange={(e) => {
										setUrl(e.target.value);
										if (urlError) {
											setUrlError(null);
										}
									}}
									placeholder="https://api.example.com/health"
									value={url}
								/>
								{isEditing ? (
									<Field.Description>
										To monitor a different URL, create a new monitor
									</Field.Description>
								) : urlError ? (
									<Field.Error>{urlError}</Field.Error>
								) : null}
							</Field>
						</div>

						<Divider />

						<Field>
							<Field.Label className="flex items-center gap-2">
								Check Frequency
								<Tooltip content="How often the monitor checks availability">
									<InfoIcon
										className="size-3.5 text-muted-foreground"
										weight="duotone"
									/>
								</Tooltip>
							</Field.Label>
							<SegmentedControl
								className="w-full"
								disabled={isPending}
								onChange={setGranularity}
								options={granularityOptions}
								value={granularity}
							/>
						</Field>

						<Divider />

						<div className="space-y-4">
							<SettingsRow
								description="Max wait time before timing out"
								label="Timeout"
							>
								<Input
									className="w-24"
									max={120}
									min={1}
									onChange={(e) => {
										const val = e.target.value;
										setTimeoutMs(val ? Number(val) * 1000 : null);
									}}
									placeholder="30"
									suffix="sec"
									type="number"
									value={timeoutMs ? timeoutMs / 1000 : ""}
								/>
							</SettingsRow>

							<Divider />

							<SettingsRow
								description="Bypass CDN caches with a random query parameter"
								label="Cache busting"
							>
								<Switch checked={cacheBust} onCheckedChange={setCacheBust} />
							</SettingsRow>

							<Divider />

							<SettingsRow
								description="Parse JSON responses for status and latency"
								label="Capture service latency"
							>
								<Switch
									checked={jsonParsingEnabled}
									onCheckedChange={setJsonParsingEnabled}
								/>
							</SettingsRow>
						</div>

						{isEditing && (
							<>
								<Divider />

								<div className="space-y-4">
									<div className="space-y-0.5">
										<p className="font-medium text-sm">Alerts</p>
										<p className="text-muted-foreground text-xs">
											Choose which alerts fire when this monitor goes down
										</p>
									</div>

									{alarms.length === 0 ? (
										<div className="flex items-center gap-3 rounded-md border border-dashed border-border/60 p-3">
											<BellIcon
												className="size-4 shrink-0 text-muted-foreground"
												weight="duotone"
											/>
											<Text tone="muted" variant="caption">
												No alerts configured.{" "}
												<Link
													className="text-primary hover:underline"
													href="/settings/notifications"
												>
													Create one
												</Link>
											</Text>
										</div>
									) : (
										<div className="space-y-4">
											{alarms.map((alarm) => (
												<AlarmRow
													alarm={alarm}
													isLinked={alarm.linkedIds.includes(
														schedule?.id ?? "",
													)}
													isPending={alarmUpdateMutation.isPending}
													key={alarm.id}
													onToggle={() => toggleAlarm(alarm)}
												/>
											))}
										</div>
									)}
								</div>
							</>
						)}
					</Sheet.Body>

					<Sheet.Footer>
						<Button
							onClick={() => onCloseAction(false)}
							type="button"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button
							className="min-w-28"
							disabled={!canSubmit}
							loading={isPending}
							type="submit"
						>
							{isEditing ? "Update" : "Create"}
						</Button>
					</Sheet.Footer>
				</form>
			</Sheet.Content>
		</Sheet>
	);
}
