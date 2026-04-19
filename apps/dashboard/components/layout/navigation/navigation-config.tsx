import { GATED_FEATURES } from "@databuddy/shared/types/features";
import type { Category, NavigationEntry, NavigationSection } from "./types";

import {
	IconAlertWarningFillDuo18,
	IconAntennaFillDuo18,
	IconBellFillDuo18,
	IconBoltLightningFillDuo18,
	IconBookOpenFillDuo18,
	IconBugFillDuo18,
	IconChartBarTrendUpFillDuo18,
	IconChartLine2FillDuo18,
	IconCodeFillDuo18,
	IconCoinsFillDuo18,
	IconCompassFillDuo18,
	IconCreditCardFillDuo18,
	IconExternalLinkFillDuo18,
	IconEye2FillDuo18,
	IconEyeFillDuo18,
	IconFileDownloadFillDuo18,
	IconFilterFillDuo18,
	IconFlag2FillDuo18,
	IconGearFillDuo18,
	IconGlobeFillDuo18,
	IconHeartPulseFillDuo18,
	IconHouse4FillDuo18,
	IconKeyFillDuo18,
	IconLink5FillDuo18,
	IconLocationFillDuo18,
	IconLockFillDuo18,
	IconMegaphoneFillDuo18,
	IconOfficeFillDuo18,
	IconRadarFillDuo18,
	IconReceiptFillDuo18,
	IconRoadmapFillDuo18,
	IconRobotFillDuo18,
	IconShieldCheckFillDuo18,
	IconSparkleFillDuo18,
	IconSquareActivityChartFillDuo18,
	IconSubscriptionFillDuo18,
	IconTargetFillDuo18,
	IconUserContactFillDuo18,
	IconUserFillDuo18,
	IconUsersFillDuo18,
	IconVideoFillDuo18,
	IconWalletFillDuo18,
} from "nucleo-ui-fill-duo-18";
const createNavItem = (
	name: string,
	icon: any,
	href: string,
	options: Record<string, any> = {}
) => ({
	name,
	icon,
	href,
	rootLevel: true,
	...options,
});

const createNavSection = (
	title: string,
	icon: any,
	items: NavigationSection["items"],
	options: Partial<NavigationSection> = {}
): NavigationSection => ({
	title,
	icon,
	items,
	...options,
});

export const filterCategoriesForRoute = (
	categories: Category[],
	pathname: string
) => {
	const isDemo = pathname.startsWith("/demo");
	return categories.filter((category) => !(category.hideFromDemo && isDemo));
};

/**
 * Hides flag-gated categories until the client has mounted, then applies the same
 * rule as main navigation: only show when the flag is ready and on. Prevents
 * hydration mismatches from `isOn` / flag store differing between SSR and first paint.
 */
export function filterCategoriesByFlags(
	categories: Category[],
	hasMounted: boolean,
	getFlag: (key: string) => { status: string; on: boolean }
): Category[] {
	return categories.filter((category) => {
		if (!category.flag) {
			return true;
		}
		if (!hasMounted) {
			return false;
		}
		const flagState = getFlag(category.flag);
		return flagState.status === "ready" && flagState.on;
	});
}

export const homeNavigation: NavigationEntry[] = [
	createNavSection("Overview", IconHouse4FillDuo18, [
		createNavItem("Home", IconHouse4FillDuo18, "/home", {
			highlight: true,
		}),
		createNavItem("Websites", IconGlobeFillDuo18, "/websites", {
			highlight: true,
		}),
		createNavItem("Insights", IconSparkleFillDuo18, "/insights", {
			highlight: true,
		}),
	]),
	createNavSection("Observability", IconChartLine2FillDuo18, [
		createNavItem("Links", IconLink5FillDuo18, "/links", {
			highlight: true,
		}),
		createNavItem("Custom Events", IconBoltLightningFillDuo18, "/events", {
			highlight: true,
		}),
	]),
];

export const settingsNavigation: NavigationSection[] = [
	createNavSection("Workspace", IconOfficeFillDuo18, [
		createNavItem("General", IconGearFillDuo18, "/organizations/settings"),
		createNavItem("Members", IconUsersFillDuo18, "/organizations/members"),
		createNavItem("API Keys", IconKeyFillDuo18, "/organizations/settings/api-keys"),
		createNavItem("Danger Zone", IconAlertWarningFillDuo18, "/organizations/settings/danger"),
	]),
	createNavSection("Billing", IconCreditCardFillDuo18, [
		createNavItem("Overview", IconWalletFillDuo18, "/billing"),
		createNavItem("Plans", IconSubscriptionFillDuo18, "/billing/plans"),
		createNavItem("Invoices", IconReceiptFillDuo18, "/billing/history"),
	]),
	createNavSection("Account", IconUserContactFillDuo18, [
		createNavItem("Profile", IconUserFillDuo18, "/settings/account"),
		createNavItem("Appearance", IconEye2FillDuo18, "/settings/appearance"),
		createNavItem("Notifications", IconBellFillDuo18, "/settings/notifications"),
	]),
];

export const resourcesNavigation: NavigationSection[] = [
	createNavSection("Resources", IconCompassFillDuo18, [
		createNavItem("Documentation", IconBookOpenFillDuo18, "https://databuddy.cc/docs", {
			external: true,
			highlight: true,
		}),
		createNavItem(
			"Video Guides",
			IconVideoFillDuo18,
			"https://youtube.com/@trydatabuddy",
			{ external: true, highlight: true }
		),
		createNavItem(
			"Roadmap",
			IconRoadmapFillDuo18,
			"https://trello.com/b/SOUXD4wE/databuddy",
			{ external: true, highlight: true }
		),
		createNavItem(
			"Feedback",
			IconMegaphoneFillDuo18,
			"https://databuddy.featurebase.app/",
			{ external: true, highlight: true }
		),
	]),
];

export const monitorsNavigation: NavigationSection[] = [
	createNavSection("Monitoring", IconRadarFillDuo18, [
		createNavItem("All Monitors", IconHeartPulseFillDuo18, "/monitors", {
			highlight: true,
		}),
		createNavItem("Status Pages", IconAntennaFillDuo18, "/monitors/status-pages", {
			highlight: true,
		}),
	]),
];

export const websiteNavigation: NavigationSection[] = [
	createNavSection("Web Analytics", IconChartBarTrendUpFillDuo18, [
		createNavItem("Dashboard", IconEyeFillDuo18, "", { rootLevel: false }),
		createNavItem("Audience", IconUsersFillDuo18, "/audience", {
			rootLevel: false,
		}),
		createNavItem("Web Vitals", IconHeartPulseFillDuo18, "/vitals", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.WEB_VITALS,
		}),
		createNavItem("Geographic", IconLocationFillDuo18, "/map", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.GEOGRAPHIC,
		}),
		createNavItem("Error Tracking", IconBugFillDuo18, "/errors", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.ERROR_TRACKING,
		}),
		createNavItem("Anomalies", IconAlertWarningFillDuo18, "/anomalies", {
			rootLevel: false,
			alpha: true,
			flag: "anomalies",
		}),
		createNavItem("Pulse", IconChartLine2FillDuo18, "/pulse", {
			rootLevel: false,
			flag: "pulse",
			alpha: true,
		}),
	]),
	createNavSection("Product Analytics", IconChartLine2FillDuo18, [
		createNavItem("Users", IconUserFillDuo18, "/users", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.USERS,
		}),
		createNavItem("Funnels", IconFilterFillDuo18, "/funnels", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.FUNNELS,
		}),
		createNavItem("Goals", IconTargetFillDuo18, "/goals", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.GOALS,
		}),
		createNavItem("Feature Flags", IconFlag2FillDuo18, "/flags", {
			alpha: true,
			rootLevel: false,
			gatedFeature: GATED_FEATURES.FEATURE_FLAGS,
		}),
		createNavItem("Revenue", IconCoinsFillDuo18, "/revenue", {
			alpha: true,
			rootLevel: false,
			flag: "revenue",
		}),
		createNavItem("AI Agent", IconRobotFillDuo18, "/agent", {
			alpha: true,
			rootLevel: false,
		}),
	]),
];

export const websiteSettingsNavigation: NavigationSection[] = [
	createNavSection("Website Settings", IconGearFillDuo18, [
		createNavItem("General", IconGearFillDuo18, "/settings/general", {
			rootLevel: false,
		}),
		createNavItem("Privacy", IconShieldCheckFillDuo18, "/settings/privacy", {
			rootLevel: false,
		}),
		createNavItem("Security", IconLockFillDuo18, "/settings/security", {
			rootLevel: false,
		}),
		createNavItem(
			"Transfer Website",
			IconExternalLinkFillDuo18,
			"/settings/transfer",
			{ rootLevel: false }
		),
		createNavItem("Data Export", IconFileDownloadFillDuo18, "/settings/export", {
			rootLevel: false,
		}),
		createNavItem("Setup", IconCodeFillDuo18, "/settings/tracking", {
			rootLevel: false,
		}),
	]),
];

const createCategoryConfig = (
	categories: Category[],
	defaultCategory: string,
	navigationMap: Record<string, NavigationEntry[]>
) => ({ categories, defaultCategory, navigationMap });

export const categoryConfig = {
	main: createCategoryConfig(
		[
			{
				id: "home",
				name: "Home",
				icon: IconHouse4FillDuo18,
				production: true,
			},
			{
				id: "monitors",
				name: "Monitors",
				icon: IconRadarFillDuo18,
				production: true,
				flag: "monitors",
			},
			{
				id: "settings",
				name: "Settings",
				icon: IconGearFillDuo18,
				production: true,
				hideFromDemo: true,
			},
			{
				id: "resources",
				name: "Resources",
				icon: IconCompassFillDuo18,
				production: true,
			},
		],
		"home",
		{
			home: homeNavigation,
			monitors: monitorsNavigation,
			settings: settingsNavigation,
			resources: resourcesNavigation,
		}
	),
	website: createCategoryConfig(
		[
			{
				id: "analytics",
				name: "Analytics",
				icon: IconSquareActivityChartFillDuo18,
				production: true,
			},
			{
				id: "settings",
				name: "Settings",
				icon: IconGearFillDuo18,
				production: true,
				hideFromDemo: true,
			},
		],
		"analytics",
		{
			analytics: websiteNavigation,
			settings: websiteSettingsNavigation,
		}
	),
};

const PATH_CONFIG_MAP = [
	{ pattern: ["/websites/", "/demo/"], config: "website" as const },
] as const;

const CATEGORY_PATH_MAP = [
	{ pattern: "/monitors", category: "monitors" as const },
	{ pattern: "/organizations", category: "settings" as const },
	{ pattern: "/billing", category: "settings" as const },
	{ pattern: "/settings", category: "settings" as const },
] as const;

export const getContextConfig = (pathname: string) => {
	for (const item of PATH_CONFIG_MAP) {
		if (item.pattern.some((p) => pathname.startsWith(p))) {
			return categoryConfig[item.config];
		}
	}
	return categoryConfig.main;
};

export const getDefaultCategory = (pathname: string) => {
	for (const { pattern, category } of CATEGORY_PATH_MAP) {
		if (pathname.includes(pattern)) {
			return category;
		}
	}
	return getContextConfig(pathname).defaultCategory;
};
