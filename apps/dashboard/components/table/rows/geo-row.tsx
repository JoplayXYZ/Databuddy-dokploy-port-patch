import { IconLocationFillDuo18 } from "nucleo-ui-fill-duo-18";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { CountryFlag } from "@/components/icon";
import { PercentageBadge } from "@/components/ui/percentage-badge";
import { formatNumber } from "@/lib/formatters";

export interface GeoEntry {
	country_code?: string;
	country_name?: string;
	name: string;
	pageviews: number;
	percentage: number;
	visitors: number;
}

interface GeoRowProps {
	type: "country" | "region" | "city";
}

export function createGeoColumns({ type }: GeoRowProps): ColumnDef<GeoEntry>[] {
	return [
		{
			id: type,
			accessorKey: type === "country" ? "country_name" : "name",
			header: type.charAt(0).toUpperCase() + type.slice(1),
			cell: (info: CellContext<GeoEntry, any>) => {
				const entry = info.row.original;
				const name = (info.getValue() as string) || "";
				const countryCode = entry.country_code;
				const countryName = entry.country_name;

				const getIcon = () => {
					if (countryCode && countryCode !== "Unknown") {
						return <CountryFlag country={countryCode} size={16} />;
					}
					return (
						<IconLocationFillDuo18
							className="size-4 text-muted-foreground"
						/>
					);
				};

				const formatName = () => {
					if (type === "country") {
						return name || "Unknown";
					}
					// Region and City format: "Name, Country"
					if (countryName && name) {
						return `${name}, ${countryName}`;
					}
					return name || `Unknown ${type}`;
				};

				return (
					<div className="flex items-center gap-2">
						{getIcon()}
						<span className="font-medium">{formatName()}</span>
					</div>
				);
			},
		},
		{
			id: "visitors",
			accessorKey: "visitors",
			header: "Visitors",
			cell: (info: CellContext<GeoEntry, any>) => (
				<span className="font-medium">{formatNumber(info.getValue())}</span>
			),
		},
		{
			id: "pageviews",
			accessorKey: "pageviews",
			header: "Pageviews",
			cell: (info: CellContext<GeoEntry, any>) => (
				<span className="font-medium">{formatNumber(info.getValue())}</span>
			),
		},
		{
			id: "percentage",
			accessorKey: "percentage",
			header: "Share",
			cell: (info: CellContext<GeoEntry, any>) => {
				const percentage = info.getValue() as number;
				return <PercentageBadge percentage={percentage} />;
			},
		},
	];
}
