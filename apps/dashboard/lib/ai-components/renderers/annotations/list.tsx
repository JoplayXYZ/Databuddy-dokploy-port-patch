"use client";

import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { fromNow } from "@databuddy/ui";
import type { BaseComponentProps } from "../../types";
import {
	CalendarIcon,
	DotsThreeIcon,
	NoteIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
} from "@databuddy/ui/icons";

interface AnnotationItem {
	annotationType: "point" | "line" | "range";
	color?: string | null;
	createdAt?: string;
	id: string;
	isPublic?: boolean;
	tags?: string[];
	text: string;
	xEndValue?: string | null;
	xValue: string;
}

export interface AnnotationsListProps extends BaseComponentProps {
	annotations: AnnotationItem[];
	title?: string;
}

function AnnotationTypeLabel({ type }: { type: string }) {
	const labels: Record<string, string> = {
		point: "Point",
		line: "Line",
		range: "Range",
	};
	return (
		<Badge className="text-[10px]" variant="muted">
			{labels[type] ?? type}
		</Badge>
	);
}

function AnnotationRow({
	annotation,
	onEdit,
	onDelete,
}: {
	annotation: AnnotationItem;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const dateDisplay =
		annotation.annotationType === "range" && annotation.xEndValue
			? `${new Date(annotation.xValue).toLocaleDateString()} - ${new Date(annotation.xEndValue).toLocaleDateString()}`
			: new Date(annotation.xValue).toLocaleDateString();

	return (
		// biome-ignore lint/a11y/useSemanticElements: Can't use button - contains nested buttons (dropdown trigger)
		<div
			className="group flex w-full cursor-default items-start gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50"
			role="listitem"
		>
			<div
				className="mt-0.5 shrink-0 rounded border p-1.5"
				style={{
					borderColor: annotation.color ?? "var(--border)",
					backgroundColor: annotation.color
						? `${annotation.color}10`
						: "var(--accent)",
				}}
			>
				<NoteIcon
					className="size-3.5"
					style={{ color: annotation.color ?? "var(--muted-foreground)" }}
					weight="duotone"
				/>
			</div>

			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">{annotation.text}</p>
				<div className="mt-1.5 flex flex-wrap items-center gap-2">
					<AnnotationTypeLabel type={annotation.annotationType} />
					<span className="flex items-center gap-1 text-muted-foreground text-xs">
						<CalendarIcon className="size-3" weight="duotone" />
						{dateDisplay}
					</span>
					{Array.isArray(annotation.tags) && annotation.tags.length > 0 && (
						<div className="flex gap-1">
							{annotation.tags.slice(0, 3).map((tag) => (
								<Badge className="text-[10px]" key={tag} variant="default">
									{tag}
								</Badge>
							))}
							{annotation.tags.length > 3 && (
								<Badge className="text-[10px]" variant="default">
									+{annotation.tags.length - 3}
								</Badge>
							)}
						</div>
					)}
					{annotation.isPublic && (
						<Badge className="text-[10px]" variant="muted">
							Public
						</Badge>
					)}
				</div>
			</div>

			{annotation.createdAt && (
				<span className="hidden shrink-0 text-muted-foreground text-xs lg:block">
					{fromNow(annotation.createdAt)}
				</span>
			)}

			<div
				className="shrink-0"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="presentation"
			>
				<DropdownMenu>
					<DropdownMenu.Trigger
						aria-label="Actions"
						className="inline-flex size-7 items-center justify-center gap-1.5 rounded-md bg-transparent p-0 font-medium text-muted-foreground opacity-50 transition-all duration-(--duration-quick) ease-(--ease-smooth) hover:bg-interactive-hover hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:opacity-100"
					>
						<DotsThreeIcon className="size-4" weight="bold" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" className="w-40">
						<DropdownMenu.Item className="gap-2" onClick={onEdit}>
							<PencilSimpleIcon className="size-4" weight="duotone" />
							Edit
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							className="gap-2"
							onClick={onDelete}
							variant="destructive"
						>
							<TrashIcon className="size-4" weight="duotone" />
							Delete
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu>
			</div>
		</div>
	);
}

export function AnnotationsListRenderer({
	title,
	annotations,
	className,
}: AnnotationsListProps) {
	// Note: Full CRUD operations would require the chart context which is complex
	// For now, display-only with action hints
	const handleEdit = (id: string) => {
		console.log("Edit annotation:", id);
	};

	const handleDelete = (id: string) => {
		console.log("Delete annotation:", id);
	};

	if (annotations.length === 0) {
		return (
			<Card
				className={className ?? "gap-0 overflow-hidden border bg-card py-0"}
			>
				<div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
					<NoteIcon
						className="size-8 text-muted-foreground/40"
						weight="duotone"
					/>
					<p className="font-medium text-sm">No annotations found</p>
					<p className="text-muted-foreground text-xs">
						Add annotations to mark important events on charts
					</p>
					<Button className="mt-2" size="sm" variant="secondary">
						<PlusIcon className="size-4" />
						Create Annotation
					</Button>
				</div>
			</Card>
		);
	}

	return (
		<Card className={className ?? "gap-0 overflow-hidden border bg-card py-0"}>
			{title && (
				<div className="flex items-center justify-between border-b px-3 py-2">
					<p className="font-medium text-sm">{title}</p>
				</div>
			)}
			<ul>
				{annotations.map((annotation) => (
					<AnnotationRow
						annotation={annotation}
						key={annotation.id}
						onDelete={() => handleDelete(annotation.id)}
						onEdit={() => handleEdit(annotation.id)}
					/>
				))}
			</ul>
			<div className="border-t bg-muted/30 px-3 py-1.5">
				<p className="text-muted-foreground text-xs">
					{annotations.length}{" "}
					{annotations.length === 1 ? "annotation" : "annotations"}
				</p>
			</div>
		</Card>
	);
}
