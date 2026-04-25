import type { GatedFeatureId } from "@databuddy/shared/types/features";
import type React from "react";

export type NavIcon = React.ComponentType<{
	className?: string;
	size?: number | string;
}>;

export interface NavigationItem {
	alpha?: boolean;
	badge?: {
		text: string;
		variant: "purple" | "blue" | "green" | "orange" | "red";
	};
	disabled?: boolean;
	domain?: string;
	external?: boolean;
	flag?: string;
	gatedFeature?: GatedFeatureId;
	hideFromDemo?: boolean;
	highlight?: boolean;
	href: string;
	icon: NavIcon;
	name: string;
	production?: boolean;
	rootLevel?: boolean;
	showOnlyOnDemo?: boolean;
	tag?: string;
}

export interface NavigationSection {
	flag?: string;
	icon: NavIcon;
	items: NavigationItem[];
	title: string;
}

export interface NavigationGroup {
	back?: { href: string; label: string };
	flag?: string;
	items: NavigationItem[];
	label: string;
	pinToBottom?: boolean;
}

export type NavigationEntry = NavigationSection | NavigationItem;
