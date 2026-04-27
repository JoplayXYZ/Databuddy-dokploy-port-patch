import type { IconProps } from "@phosphor-icons/react";
import type { ReactElement } from "react";
import { EmptyState } from "@databuddy/ui";

interface TableEmptyStateProps {
	description: string;
	icon: ReactElement<IconProps>;
	title: string;
}

export function TableEmptyState({
	icon,
	title,
	description,
}: TableEmptyStateProps) {
	return <EmptyState description={description} icon={icon} title={title} />;
}
