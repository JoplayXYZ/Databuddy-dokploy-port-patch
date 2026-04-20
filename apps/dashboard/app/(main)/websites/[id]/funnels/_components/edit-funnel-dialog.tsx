"use client";

import { filterOptions } from "@databuddy/shared/lists/filters";
import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { DotsNineIcon } from "@phosphor-icons/react/dist/ssr";
import { FunnelIcon } from "@phosphor-icons/react/dist/ssr";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Button } from "@/components/ds/button";
import { Field } from "@/components/ds/field";
import { Sheet } from "@/components/ds/sheet";
import { Input } from "@/components/ds/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ds/switch";
import type { AutocompleteData } from "@/hooks/use-autocomplete";
import { goalFunnelOperatorOptions, useFilters } from "@/hooks/use-filters";
import { cn } from "@/lib/utils";
import type {
	CreateFunnelData,
	Funnel,
	FunnelFilter,
	FunnelStep,
} from "@/types/funnels";

const defaultFilter: FunnelFilter = {
	field: "browser_name",
	operator: "equals",
	value: "",
} as const;

interface EditFunnelDialogProps {
	autocompleteData?: AutocompleteData;
	funnel: Funnel | null;
	isCreating?: boolean;
	isOpen: boolean;
	isUpdating: boolean;
	onClose: () => void;
	onCreate?: (data: CreateFunnelData) => Promise<void>;
	onSubmit: (funnel: Funnel) => Promise<void>;
}

export function EditFunnelDialog({
	isOpen,
	onClose,
	onSubmit,
	onCreate,
	funnel,
	isUpdating,
	isCreating = false,
	autocompleteData,
}: EditFunnelDialogProps) {
	const [formData, setFormData] = useState<Funnel | null>(null);
	const isCreateMode = !funnel;

	useEffect(() => {
		if (funnel) {
			// Ensure all filters have valid operators (default to "equals" if missing)
			const sanitizedFilters = (funnel.filters || []).map((f) => ({
				...f,
				operator: f.operator || "equals",
			}));
			setFormData({
				...funnel,
				filters: sanitizedFilters,
				ignoreHistoricData: funnel.ignoreHistoricData ?? false,
			});
		} else {
			setFormData({
				id: "",
				name: "",
				description: "",
				steps: [
					{ type: "PAGE_VIEW" as const, target: "/", name: "Landing Page" },
					{
						type: "PAGE_VIEW" as const,
						target: "/signup",
						name: "Sign Up Page",
					},
				],
				filters: [],
				ignoreHistoricData: false,
				isActive: true,
				createdAt: "",
				updatedAt: "",
			});
		}
	}, [funnel]);

	const handleSubmit = async () => {
		if (!formData) {
			return;
		}

		// Ensure all filters have valid operators (default to "equals" if missing)
		const sanitizedFilters = (formData.filters || []).map((f) => ({
			...f,
			operator: f.operator || "equals",
		}));

		if (isCreateMode && onCreate) {
			const createData: CreateFunnelData = {
				name: formData.name,
				description: formData.description || undefined,
				steps: formData.steps,
				filters: sanitizedFilters,
				ignoreHistoricData: formData.ignoreHistoricData,
			};
			await onCreate(createData);
			resetForm();
		} else {
			await onSubmit({
				...formData,
				filters: sanitizedFilters,
			});
		}
	};

	const resetForm = useCallback(() => {
		if (isCreateMode) {
			setFormData({
				id: "",
				name: "",
				description: "",
				steps: [
					{ type: "PAGE_VIEW" as const, target: "/", name: "Landing Page" },
					{
						type: "PAGE_VIEW" as const,
						target: "/signup",
						name: "Sign Up Page",
					},
				],
				filters: [],
				ignoreHistoricData: false,
				isActive: true,
				createdAt: "",
				updatedAt: "",
			});
		}
	}, [isCreateMode]);

	const addStep = useCallback(() => {
		if (!formData) {
			return;
		}
		setFormData((prev) =>
			prev
				? {
						...prev,
						steps: [
							...prev.steps,
							{ type: "PAGE_VIEW" as const, target: "", name: "" },
						],
					}
				: prev
		);
	}, [formData]);

	const removeStep = useCallback(
		(index: number) => {
			if (!formData || formData.steps.length <= 2) {
				return;
			}
			setFormData((prev) =>
				prev
					? { ...prev, steps: prev.steps.filter((_, i) => i !== index) }
					: prev
			);
		},
		[formData]
	);

	const updateStep = useCallback(
		(index: number, field: keyof FunnelStep, value: string) => {
			setFormData((prev) =>
				prev
					? {
							...prev,
							steps: prev.steps.map((step, i) =>
								i === index ? { ...step, [field]: value } : step
							),
						}
					: prev
			);
		},
		[]
	);

	const reorderSteps = useCallback(
		(result: DropResult) => {
			if (!(result.destination && formData)) {
				return;
			}

			const sourceIndex = result.source.index;
			const destinationIndex = result.destination.index;

			if (sourceIndex === destinationIndex) {
				return;
			}

			const items = [...formData.steps];
			const [reorderedItem] = items.splice(sourceIndex, 1);
			items.splice(destinationIndex, 0, reorderedItem);

			setFormData((prev) => (prev ? { ...prev, steps: items } : prev));
		},
		[formData]
	);

	const handleFiltersChange = useCallback((newFilters: FunnelFilter[]) => {
		setFormData((prev) => (prev ? { ...prev, filters: newFilters } : prev));
	}, []);

	const { addFilter, removeFilter, updateFilter } = useFilters({
		filters: formData?.filters || [],
		onFiltersChange: handleFiltersChange,
		defaultFilter,
	});

	const getSuggestions = useCallback(
		(field: string): string[] => {
			if (!autocompleteData) {
				return [];
			}

			switch (field) {
				case "browser_name":
					return autocompleteData.browsers || [];
				case "os_name":
					return autocompleteData.operatingSystems || [];
				case "country":
					return autocompleteData.countries || [];
				case "device_type":
					return autocompleteData.deviceTypes || [];
				case "utm_source":
					return autocompleteData.utmSources || [];
				case "utm_medium":
					return autocompleteData.utmMediums || [];
				case "utm_campaign":
					return autocompleteData.utmCampaigns || [];
				default:
					return [];
			}
		},
		[autocompleteData]
	);

	const getStepSuggestions = useCallback(
		(stepType: string): string[] => {
			if (!autocompleteData) {
				return [];
			}

			if (stepType === "PAGE_VIEW") {
				return autocompleteData.pagePaths || [];
			}
			if (stepType === "EVENT") {
				return autocompleteData.customEvents || [];
			}

			return [];
		},
		[autocompleteData]
	);

	const handleClose = useCallback(() => {
		onClose();
		if (isCreateMode) {
			resetForm();
		}
	}, [onClose, isCreateMode, resetForm]);

	const isFormValid = useMemo(() => {
		if (!formData) {
			return false;
		}
		return (
			formData.name &&
			!formData.steps.some((s) => !(s.name && s.target)) &&
			!(formData.filters || []).some((f) => !f.value || f.value === "")
		);
	}, [formData]);

	if (!formData) {
		return null;
	}

	return (
		<Sheet onOpenChange={handleClose} open={isOpen}>
			<Sheet.Content side="right">
				<Sheet.Header>
					<div className="flex items-start gap-4">
						<div className="flex size-11 items-center justify-center rounded border bg-background">
							<FunnelIcon
								className="size-[22px] text-accent-foreground"
								weight="fill"
							/>
						</div>
						<div className="min-w-0 flex-1">
							<Sheet.Title className="truncate text-lg">
								{isCreateMode ? "New Funnel" : formData.name || "Edit Funnel"}
							</Sheet.Title>
							<Sheet.Description className="text-xs">
								{isCreateMode
									? "Track user conversion journeys"
									: `${formData.steps.length} steps configured`}
							</Sheet.Description>
						</div>
					</div>
				</Sheet.Header>

				<Sheet.Close />

				<Sheet.Body className="space-y-6">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Field.Label htmlFor="funnel-name">Name</Field.Label>
							<Input
								id="funnel-name"
								onChange={(e) =>
									setFormData((prev) =>
										prev ? { ...prev, name: e.target.value } : prev
									)
								}
								placeholder="e.g., Sign Up Flow"
								value={formData.name}
							/>
						</div>
						<div className="space-y-2">
							<Field.Label htmlFor="funnel-description">
								Description
							</Field.Label>
							<Input
								id="funnel-description"
								onChange={(e) =>
									setFormData((prev) =>
										prev ? { ...prev, description: e.target.value } : prev
									)
								}
								placeholder="Optional"
								value={formData.description || ""}
							/>
						</div>
					</div>

					<section className="space-y-3">
						<div className="flex items-center justify-between">
							<Field.Label className="text-muted-foreground text-xs">
								Funnel Steps
							</Field.Label>
							<span className="text-muted-foreground text-xs">
								Drag to reorder
							</span>
						</div>

						<DragDropContext onDragEnd={reorderSteps}>
							<Droppable droppableId="funnel-steps">
								{(provided, snapshot) => (
									<div
										{...provided.droppableProps}
										className={cn(
											"space-y-2",
											snapshot.isDraggingOver && "rounded bg-accent/50 p-2"
										)}
										ref={provided.innerRef}
									>
										{formData.steps.map((step, index) => (
											<Draggable
												draggableId={`step-${index}`}
												index={index}
												key={`step-${index}`}
											>
												{(provided, snapshot) => (
													<div
														ref={provided.innerRef}
														{...provided.draggableProps}
														className={cn(
															"flex items-center gap-2 rounded border bg-card p-2.5 transition-all",
															snapshot.isDragging &&
																"border-primary shadow-lg ring-2 ring-primary/20"
														)}
													>
														<div
															{...provided.dragHandleProps}
															className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
														>
															<DotsNineIcon className="size-4" />
														</div>

														<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-foreground font-semibold text-accent text-xs">
															{index + 1}
														</div>

														<div className="grid flex-1 grid-cols-3 gap-2">
															<Select
																onValueChange={(value) =>
																	updateStep(index, "type", value)
																}
																value={step.type}
															>
																<SelectTrigger
																	className="w-full text-xs"
																	size="sm"
																>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value="PAGE_VIEW">
																		Page View
																	</SelectItem>
																	<SelectItem value="EVENT">Event</SelectItem>
																</SelectContent>
															</Select>
															<AutocompleteInput
																className="text-xs"
																inputClassName="h-8"
																onValueChange={(value) =>
																	updateStep(index, "target", value)
																}
																placeholder={
																	step.type === "PAGE_VIEW"
																		? "/path"
																		: "event_name"
																}
																suggestions={getStepSuggestions(step.type)}
																value={step.target || ""}
															/>
															<Input
																className="h-8 text-xs"
																onChange={(e) =>
																	updateStep(index, "name", e.target.value)
																}
																placeholder="Step name"
																value={step.name}
															/>
														</div>

														{formData.steps.length > 2 && (
															<Button
																className="size-6 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
																onClick={() => removeStep(index)}
																variant="ghost"
															>
																<TrashIcon className="size-3.5" />
															</Button>
														)}
													</div>
												)}
											</Draggable>
										))}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>

						<Button
							className="w-full"
							disabled={formData.steps.length >= 10}
							onClick={addStep}
							size="sm"
							variant="secondary"
						>
							<PlusIcon className="size-3.5" />
							Add Step
						</Button>
					</section>

					<section className="space-y-3">
						<Field.Label className="text-muted-foreground text-xs">
							Settings
						</Field.Label>
						<div className="flex items-center justify-between rounded border bg-card p-3">
							<div className="space-y-0.5">
								<Field.Label
									className="font-medium text-sm"
									htmlFor="ignore-historic"
								>
									Ignore historic data
								</Field.Label>
								<p className="text-muted-foreground text-xs">
									Only count events after this funnel was created
								</p>
							</div>
							<Switch
								checked={formData.ignoreHistoricData ?? false}
								id="ignore-historic"
								onCheckedChange={(checked) =>
									setFormData((prev) =>
										prev ? { ...prev, ignoreHistoricData: checked } : prev
									)
								}
							/>
						</div>
					</section>

					<section className="space-y-3">
						<Field.Label className="text-muted-foreground text-xs">
							Filters (Optional)
						</Field.Label>

						{formData.filters && formData.filters.length > 0 && (
							<div className="space-y-2">
								{formData.filters.map((filter, index) => (
									<div
										className="flex items-center gap-2 rounded border bg-card p-2.5"
										key={`filter-${index}`}
									>
										<Select
											onValueChange={(value) =>
												updateFilter(index, "field", value)
											}
											value={filter.field}
										>
											<SelectTrigger className="h-8 w-28 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{filterOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<Select
											onValueChange={(value) =>
												updateFilter(index, "operator", value)
											}
											value={filter.operator || "equals"}
										>
											<SelectTrigger className="h-8 w-24 text-xs">
												<SelectValue placeholder="equals" />
											</SelectTrigger>
											<SelectContent>
												{goalFunnelOperatorOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<AutocompleteInput
											className="flex-1 text-xs"
											onValueChange={(value) =>
												updateFilter(index, "value", value)
											}
											placeholder="Value"
											suggestions={getSuggestions(filter.field)}
											value={(filter.value as string) || ""}
										/>

										<Button
											className="size-6 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											onClick={() => removeFilter(index)}
											variant="ghost"
										>
											<TrashIcon className="size-3.5" />
										</Button>
									</div>
								))}
							</div>
						)}

						<Button
							className="w-full"
							onClick={() => addFilter()}
							size="sm"
							variant="secondary"
						>
							<PlusIcon className="size-3.5" />
							Add Filter
						</Button>
					</section>
				</Sheet.Body>

				<Sheet.Footer>
					<Button onClick={handleClose} variant="secondary">
						Cancel
					</Button>
					<Button
						disabled={!isFormValid}
						loading={isCreateMode ? isCreating : isUpdating}
						onClick={handleSubmit}
					>
						{isCreateMode ? "Create Funnel" : "Save Changes"}
					</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet>
	);
}
