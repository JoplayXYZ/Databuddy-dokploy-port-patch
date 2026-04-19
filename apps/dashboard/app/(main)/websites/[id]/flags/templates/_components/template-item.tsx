"use client";

import {
	IconAlertWarningFillDuo18,
	IconArrowRightFillDuo18,
	IconFlaskFillDuo18,
	IconRocketFillDuo18,
	IconUsersFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { FlagTemplate } from "../../_components/types";

export interface TemplateItemProps {
	onUseAction: (template: FlagTemplate) => void;
	template: FlagTemplate;
}

function getTemplateIcon(icon: string) {
	switch (icon) {
		case "rocket":
			return IconRocketFillDuo18;
		case "test":
			return IconFlaskFillDuo18;
		case "users":
			return IconUsersFillDuo18;
		case "warning":
			return IconAlertWarningFillDuo18;
		default:
			return IconRocketFillDuo18;
	}
}

function getCategoryColor(
	category: string
): "blue" | "amber" | "green" | "destructive" | "gray" {
	switch (category) {
		case "rollout":
			return "blue";
		case "experiment":
			return "amber";
		case "targeting":
			return "green";
		case "killswitch":
			return "destructive";
		default:
			return "gray";
	}
}

export function TemplateItem({ template, onUseAction }: TemplateItemProps) {
	const TemplateIcon = getTemplateIcon(template.icon);
	const categoryColor = getCategoryColor(template.category);

	return (
		<Card className="group relative flex flex-col overflow-hidden transition-all hover:border-primary/50 hover:shadow-md">
			<CardHeader className="space-y-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex size-10 shrink-0 items-center justify-center rounded bg-primary/10">
						<TemplateIcon className="size-5 text-primary" />
					</div>
					{template.isBuiltIn && (
						<Badge className="shrink-0" variant="outline">
							Built-in
						</Badge>
					)}
				</div>
				<CardTitle className="line-clamp-1 text-lg">{template.name}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 space-y-3">
				<CardDescription className="line-clamp-2 text-sm">
					{template.description}
				</CardDescription>
				<div className="flex items-center gap-2">
					<Badge variant={categoryColor}>{template.category}</Badge>
					<Badge variant="outline">{template.type}</Badge>
				</div>
			</CardContent>
			<CardFooter>
				<Button
					className="w-full gap-2"
					onClick={() => onUseAction(template)}
					size="sm"
				>
					Use Template
					<IconArrowRightFillDuo18 className="size-4" />
				</Button>
			</CardFooter>
		</Card>
	);
}
