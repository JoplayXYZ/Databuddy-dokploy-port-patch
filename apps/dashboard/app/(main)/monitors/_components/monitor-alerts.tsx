"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import {
	BellIcon,
	CheckIcon,
	PlusIcon,
	TrashIcon,
} from "@databuddy/ui/icons";
import { Badge, Button, Text } from "@databuddy/ui";
import { DropdownMenu } from "@databuddy/ui/client";

interface Alarm {
	id: string;
	name: string;
	enabled: boolean;
	triggerConditions?: Record<string, unknown>;
	destinations?: Array<{ id: string; type: string }>;
}

function parseAlarmList(rows: readonly Record<string, unknown>[]): Alarm[] {
	const out: Alarm[] = [];
	for (const row of rows) {
		if (
			typeof row.id !== "string" ||
			typeof row.name !== "string" ||
			typeof row.enabled !== "boolean"
		) {
			continue;
		}
		out.push({
			id: row.id,
			name: row.name,
			enabled: row.enabled,
			triggerConditions:
				typeof row.triggerConditions === "object" && row.triggerConditions
					? (row.triggerConditions as Record<string, unknown>)
					: undefined,
			destinations: Array.isArray(row.destinations)
				? (row.destinations as Alarm["destinations"])
				: undefined,
		});
	}
	return out;
}

function getMonitorIds(alarm: Alarm): string[] {
	return Array.isArray(alarm.triggerConditions?.monitorIds)
		? (alarm.triggerConditions.monitorIds as string[])
		: [];
}

const DEST_LABELS: Record<string, string> = {
	slack: "Slack",
	email: "Email",
	webhook: "Webhook",
};

interface MonitorAlertsProps {
	scheduleId: string;
}

export function MonitorAlerts({ scheduleId }: MonitorAlertsProps) {
	const queryClient = useQueryClient();
	const [isAttaching, setIsAttaching] = useState<string | null>(null);

	const { data: rawAlarms, isLoading } = useQuery({
		...orpc.alarms.list.queryOptions({ input: {} }),
	});

	const updateMutation = useMutation({
		...orpc.alarms.update.mutationOptions(),
	});

	const alarms = parseAlarmList(
		(rawAlarms ?? []) as readonly Record<string, unknown>[],
	);

	const attached = alarms.filter((a) =>
		getMonitorIds(a).includes(scheduleId),
	);
	const available = alarms.filter(
		(a) => !getMonitorIds(a).includes(scheduleId),
	);

	const handleAttach = async (alarm: Alarm) => {
		setIsAttaching(alarm.id);
		const existing = getMonitorIds(alarm);
		try {
			await updateMutation.mutateAsync({
				alarmId: alarm.id,
				triggerConditions: {
					...(alarm.triggerConditions ?? {}),
					monitorIds: [...existing, scheduleId],
				},
			});
			await queryClient.invalidateQueries({ queryKey: orpc.alarms.list.key() });
			toast.success(`Attached "${alarm.name}"`);
		} catch {
			toast.error("Failed to attach alert");
		} finally {
			setIsAttaching(null);
		}
	};

	const handleDetach = async (alarm: Alarm) => {
		const existing = getMonitorIds(alarm);
		try {
			await updateMutation.mutateAsync({
				alarmId: alarm.id,
				triggerConditions: {
					...(alarm.triggerConditions ?? {}),
					monitorIds: existing.filter((id) => id !== scheduleId),
				},
			});
			await queryClient.invalidateQueries({ queryKey: orpc.alarms.list.key() });
			toast.success(`Detached "${alarm.name}"`);
		} catch {
			toast.error("Failed to detach alert");
		}
	};

	if (isLoading) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 px-4 sm:px-6">
			<BellIcon className="size-3.5 shrink-0 text-muted-foreground" weight="duotone" />

			{attached.length > 0 ? (
				attached.map((alarm) => (
					<Badge
						className="group/alert gap-1 pr-1"
						key={alarm.id}
						variant={alarm.enabled ? "default" : "muted"}
					>
						{alarm.name}
						{alarm.destinations?.map((d) => (
							<span
								className="text-[10px] text-muted-foreground"
								key={d.id}
							>
								{DEST_LABELS[d.type] ?? d.type}
							</span>
						))}
						<button
							className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover/alert:opacity-100"
							onClick={() => handleDetach(alarm)}
							type="button"
						>
							<TrashIcon className="size-2.5" />
						</button>
					</Badge>
				))
			) : (
				<Text className="text-xs" tone="muted">
					No alerts
				</Text>
			)}

			{available.length > 0 && (
				<DropdownMenu>
					<DropdownMenu.Trigger className="inline-flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-interactive-hover hover:text-foreground">
						<PlusIcon className="size-3" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start" className="w-48">
						<DropdownMenu.Group>
							<DropdownMenu.GroupLabel>Attach alert</DropdownMenu.GroupLabel>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						{available.map((alarm) => (
							<DropdownMenu.Item
								disabled={isAttaching === alarm.id}
								key={alarm.id}
								onClick={() => handleAttach(alarm)}
							>
								<BellIcon className="size-4" weight="duotone" />
								{alarm.name}
								{!alarm.enabled && (
									<Badge className="ml-auto" size="sm" variant="muted">
										Paused
									</Badge>
								)}
							</DropdownMenu.Item>
						))}
					</DropdownMenu.Content>
				</DropdownMenu>
			)}

			{alarms.length === 0 && (
				<Text className="text-xs" tone="muted">
					No alerts configured.{" "}
					<a className="text-primary hover:underline" href="/settings/notifications">
						Create one
					</a>
				</Text>
			)}
		</div>
	);
}
