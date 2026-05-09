import type { Website as WebsiteSchema } from "@databuddy/db/schema";

export type Website = WebsiteSchema;

export interface MiniChartDataPoint {
	date: string;
	value: number;
}

export interface ProcessedMiniChartData {
	data: MiniChartDataPoint[];
	hasAnyData: boolean;
	totalViews: number;
	trend: {
		type: "up" | "down" | "neutral";
		value: number;
	} | null;
}

export interface WebsiteBasic {
	domain: string;
	id: string;
	name?: string | null;
}

export interface CountryData {
	country: string;
	country_code?: string;
	pageviews: number;
	visitors: number;
}

interface RegionData {
	country: string;
	pageviews: number;
	visitors: number;
}

export interface LocationData {
	countries: CountryData[];
	regions: RegionData[];
}
