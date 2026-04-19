import {
	IconAlertWarningFillDuo18,
	IconChartBarTrendUpFillDuo18,
	IconClockFillDuo18,
	IconComputerFillDuo18,
	IconGlobeFillDuo18,
	IconGrid2FillDuo18,
	IconHandPointerFillDuo18,
	IconLink5FillDuo18,
	IconUsersFillDuo18,
} from "nucleo-ui-fill-duo-18";
import type { ElementType } from "react";

/** Icon mapping for query type categories */
export const CATEGORY_ICONS: Record<string, ElementType> = {
	Analytics: IconChartBarTrendUpFillDuo18,
	Realtime: IconClockFillDuo18,
	Devices: IconComputerFillDuo18,
	Geo: IconGlobeFillDuo18,
	Traffic: IconLink5FillDuo18,
	Engagement: IconHandPointerFillDuo18,
	Errors: IconAlertWarningFillDuo18,
	Users: IconUsersFillDuo18,
	Sessions: IconUsersFillDuo18,
	Pages: IconLink5FillDuo18,
	Performance: IconClockFillDuo18,
	Other: IconGrid2FillDuo18,
};

/** Get the icon component for a category */
export function getCategoryIcon(category: string): ElementType {
	return CATEGORY_ICONS[category] || IconGrid2FillDuo18;
}

/** Color mapping for categories (for future use in charts, badges, etc) */
export const CATEGORY_COLORS: Record<string, string> = {
	Analytics: "hsl(var(--chart-1))",
	Realtime: "hsl(var(--chart-2))",
	Devices: "hsl(var(--chart-3))",
	Geo: "hsl(var(--chart-4))",
	Traffic: "hsl(var(--chart-5))",
	Engagement: "hsl(var(--chart-1))",
	Errors: "hsl(var(--destructive))",
	Users: "hsl(var(--chart-2))",
	Sessions: "hsl(var(--chart-3))",
	Pages: "hsl(var(--chart-4))",
	Performance: "hsl(var(--chart-5))",
	Other: "hsl(var(--muted-foreground))",
};

/** Get the color for a category */
export function getCategoryColor(category: string): string {
	return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}
