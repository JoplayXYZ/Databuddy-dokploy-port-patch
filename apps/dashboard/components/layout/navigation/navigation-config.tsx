import { GATED_FEATURES } from "@databuddy/shared/types/features";
import { ActivityIcon } from "@phosphor-icons/react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { BrowserIcon } from "@phosphor-icons/react/dist/ssr/Browser";
import { BugIcon } from "@phosphor-icons/react/dist/ssr/Bug";
import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr/Buildings";
import { CalendarIcon } from "@phosphor-icons/react/dist/ssr/Calendar";
import { ChartBarIcon } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/ssr/ChartLineUp";
import { ChartPieIcon } from "@phosphor-icons/react/dist/ssr/ChartPie";
import { CodeIcon } from "@phosphor-icons/react/dist/ssr/Code";
import { CreditCardIcon } from "@phosphor-icons/react/dist/ssr/CreditCard";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/ssr/CurrencyDollar";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { FileArrowDownIcon } from "@phosphor-icons/react/dist/ssr/FileArrowDown";
import { FlagIcon } from "@phosphor-icons/react/dist/ssr/Flag";
import { FunnelIcon } from "@phosphor-icons/react/dist/ssr/Funnel";
import { GearIcon } from "@phosphor-icons/react/dist/ssr/Gear";
import { GlobeIcon } from "@phosphor-icons/react/dist/ssr/Globe";
import { GlobeSimpleIcon } from "@phosphor-icons/react/dist/ssr/GlobeSimple";
import { HeartbeatIcon } from "@phosphor-icons/react/dist/ssr/Heartbeat";
import { HouseIcon } from "@phosphor-icons/react/dist/ssr/House";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/ssr/IdentificationCard";
import { KeyIcon } from "@phosphor-icons/react/dist/ssr/Key";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr/Lightning";
import { LinkIcon } from "@phosphor-icons/react/dist/ssr/Link";
import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr/Play";
import { PlugIcon } from "@phosphor-icons/react/dist/ssr/Plug";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr/Receipt";
import { RoadHorizonIcon } from "@phosphor-icons/react/dist/ssr/RoadHorizon";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/ssr/SpeakerHigh";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { TargetIcon } from "@phosphor-icons/react/dist/ssr/Target";
import { TrendUpIcon } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { UserGearIcon } from "@phosphor-icons/react/dist/ssr/UserGear";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import type { Category, NavigationEntry, NavigationSection } from "./types";

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

const createDynamicNavigation = <T extends { id: string; name: string | null }>(
	items: T[],
	title: string,
	titleIcon: any,
	overviewName: string,
	overviewHref: string,
	itemIcon: any,
	itemHrefPrefix: string,
	emptyText: string,
	extraProps?: (item: T) => Record<string, any>
): NavigationSection[] => [
	createNavSection(title, titleIcon, [
		createNavItem(overviewName, ChartBarIcon, overviewHref, {
			highlight: true,
		}),
		...(items.length > 0
			? items.map((item) =>
					createNavItem(
						item.name || "",
						itemIcon,
						`${itemHrefPrefix}/${item.id}`,
						{
							highlight: true,
							...(extraProps?.(item) || {}),
						}
					)
				)
			: [
					createNavItem(emptyText, PlusIcon, overviewHref, {
						highlight: true,
						disabled: true,
					}),
				]),
	]),
];

export const createWebsitesNavigation = (
	websites: Array<{ id: string; name: string | null; domain: string }>
): NavigationEntry[] => [
	createNavSection("Overview", SquaresFourIcon, [
		createNavItem("Home", HouseIcon, "/home", {
			highlight: true,
		}),
		createNavItem("Insights", SparkleIcon, "/insights", {
			highlight: true,
			flag: "insights",
		}),
	]),
	...createDynamicNavigation(
		websites,
		"Websites",
		GlobeSimpleIcon,
		"Website Overview",
		"/websites",
		GlobeIcon,
		"/websites",
		"Add Your First Website",
		(website) => ({ domain: website.domain })
	),
	createNavSection("Observability", ActivityIcon, [
		createNavItem("Links", LinkIcon, "/links", {
			highlight: true,
		}),
		createNavItem("Custom Events", LightningIcon, "/events", {
			highlight: true,
		}),
	]),
];

export const personalNavigation: NavigationSection[] = [
	createNavSection("Personal", UserGearIcon, [
		createNavItem("Account", IdentificationCardIcon, "/settings/account"),
		createNavItem("Appearance", EyeIcon, "/settings/appearance"),
		createNavItem("Privacy & Data", ShieldCheckIcon, "/settings/privacy", {
			disabled: true,
			tag: "soon",
		}),
	]),
	createNavSection("Preferences", GearIcon, [
		createNavItem(
			"Analytics Behavior",
			ChartLineUpIcon,
			"/settings/analytics",
			{
				disabled: true,
				tag: "soon",
			}
		),
		createNavItem("Feature Access", FlagIcon, "/settings/features", {
			disabled: true,
			tag: "soon",
		}),
		createNavItem("Integrations", PlugIcon, "/settings/integrations", {
			disabled: true,
			tag: "soon",
		}),
		createNavItem("Notifications", BellIcon, "/settings/notifications", {
			disabled: true,
			tag: "soon",
		}),
	]),
];

export const resourcesNavigation: NavigationSection[] = [
	createNavSection("Resources", BookOpenIcon, [
		createNavItem("Documentation", BookOpenIcon, "https://databuddy.cc/docs", {
			external: true,
			highlight: true,
		}),
		createNavItem(
			"Video Guides",
			PlayIcon,
			"https://youtube.com/@trydatabuddy",
			{ external: true, highlight: true }
		),
		createNavItem(
			"Roadmap",
			RoadHorizonIcon,
			"https://trello.com/b/SOUXD4wE/databuddy",
			{ external: true, highlight: true }
		),
		createNavItem(
			"Feedback",
			SpeakerHighIcon,
			"https://databuddy.featurebase.app/",
			{ external: true, highlight: true }
		),
	]),
];

export const organizationNavigation: NavigationSection[] = [
	createNavSection("Organizations", BuildingsIcon, [
		createNavItem("Overview", ChartPieIcon, "/organizations"),
	]),
	createNavSection("Team Management", UsersThreeIcon, [
		createNavItem("Members", UserIcon, "/organizations/members"),
		createNavItem("Invitations", CalendarIcon, "/organizations/invitations"),
	]),
	createNavSection("Organization Settings", GearIcon, [
		createNavItem("General", GearIcon, "/organizations/settings"),
		createNavItem(
			"Website Access",
			GlobeSimpleIcon,
			"/organizations/settings/websites"
		),
		createNavItem("API Keys", KeyIcon, "/organizations/settings/api-keys"),
		createNavItem("Danger Zone", WarningIcon, "/organizations/settings/danger"),
	]),
];

export const billingNavigation: NavigationSection[] = [
	createNavSection("Billing & Usage", CreditCardIcon, [
		createNavItem("Usage Overview", ActivityIcon, "/billing"),
		createNavItem("Plans & Pricing", CurrencyDollarIcon, "/billing/plans"),
		createNavItem("Payment History", ReceiptIcon, "/billing/history"),
		createNavItem(
			"Cost Breakdown",
			ChartLineUpIcon,
			"/billing/cost-breakdown",
			{
				badge: { text: "Experimental", variant: "purple" as const },
			}
		),
		createNavItem("Feedback & Credits", SpeakerHighIcon, "/feedback"),
	]),
];

const statusPagesSection = createNavSection("Status Pages", BrowserIcon, [
	createNavItem("All Pages", GlobeSimpleIcon, "/monitors/status-pages"),
]);

export const createMonitorsNavigation = (
	monitors: Array<{
		id: string;
		name: string | null;
		url: string | null;
		websiteId: string | null;
		website: { id: string; name: string | null; domain: string } | null;
	}>
): NavigationSection[] => [
	...createDynamicNavigation(
		monitors.map((m) => ({
			id: m.id,
			name: m.name || m.website?.name || m.url || "Monitor",
			domain: m.website?.domain || m.url || "",
		})),
		"Monitoring",
		HeartbeatIcon,
		"All Monitors",
		"/monitors",
		HeartbeatIcon,
		"/monitors",
		"Add Your First Monitor",
		(monitor) => ({ domain: monitor.domain })
	),
	statusPagesSection,
];

export const createLoadingMonitorsNavigation = (): NavigationSection[] => [
	...createLoadingNavigation(
		"Monitoring",
		HeartbeatIcon,
		"All Monitors",
		"/monitors",
		"Loading monitors...",
		HeartbeatIcon
	),
	statusPagesSection,
];

export const websiteNavigation: NavigationSection[] = [
	createNavSection("Web Analytics", ChartBarIcon, [
		createNavItem("Dashboard", EyeIcon, "", { rootLevel: false }),
		createNavItem("Audience", UsersThreeIcon, "/audience", {
			rootLevel: false,
		}),
		createNavItem("Web Vitals", HeartbeatIcon, "/vitals", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.WEB_VITALS,
		}),
		createNavItem("Geographic", MapPinIcon, "/map", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.GEOGRAPHIC,
		}),
		createNavItem("Error Tracking", BugIcon, "/errors", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.ERROR_TRACKING,
		}),
		createNavItem("Anomalies", WarningIcon, "/anomalies", {
			rootLevel: false,
			alpha: true,
			flag: "anomalies",
		}),
		createNavItem("Pulse", HeartbeatIcon, "/pulse", {
			rootLevel: false,
			flag: "pulse",
			alpha: true,
		}),
	]),
	createNavSection("Product Analytics", TrendUpIcon, [
		createNavItem("Users", UsersThreeIcon, "/users", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.USERS,
		}),
		createNavItem("Funnels", FunnelIcon, "/funnels", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.FUNNELS,
		}),
		createNavItem("Goals", TargetIcon, "/goals", {
			rootLevel: false,
			gatedFeature: GATED_FEATURES.GOALS,
		}),
		createNavItem("Feature Flags", FlagIcon, "/flags", {
			alpha: true,
			rootLevel: false,
			gatedFeature: GATED_FEATURES.FEATURE_FLAGS,
		}),
		createNavItem("Revenue", CurrencyDollarIcon, "/revenue", {
			alpha: true,
			rootLevel: false,
			flag: "revenue",
		}),
		createNavItem("AI Agent", RobotIcon, "/agent", {
			alpha: true,
			rootLevel: false,
			tag: "WIP",
			flag: "agent",
			// gatedFeature: GATED_FEATURES.AI_AGENT,
		}),
	]),
];

export const websiteSettingsNavigation: NavigationSection[] = [
	createNavSection("Website Settings", GearIcon, [
		createNavItem("General", GearIcon, "/settings/general", {
			rootLevel: false,
		}),
		createNavItem("Privacy", ShieldCheckIcon, "/settings/privacy", {
			rootLevel: false,
		}),
		createNavItem("Security", LockIcon, "/settings/security", {
			rootLevel: false,
		}),
		createNavItem(
			"Transfer Website",
			ArrowSquareOutIcon,
			"/settings/transfer",
			{ rootLevel: false }
		),
		createNavItem("Data Export", FileArrowDownIcon, "/settings/export", {
			rootLevel: false,
		}),
		createNavItem("Setup", CodeIcon, "/settings/tracking", {
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
				icon: HouseIcon,
				production: true,
			},
			{
				id: "monitors",
				name: "Monitors",
				icon: HeartbeatIcon,
				production: true,
				flag: "monitors",
			},
			{
				id: "organizations",
				name: "Organizations",
				icon: BuildingsIcon,
				production: true,
			},
			{
				id: "billing",
				name: "Billing",
				icon: CreditCardIcon,
				production: true,
			},
			{
				id: "settings",
				name: "Settings",
				icon: GearIcon,
				production: true,
				hideFromDemo: true,
			},
			{
				id: "resources",
				name: "Resources",
				icon: BookOpenIcon,
				production: true,
			},
		],
		"home",
		{
			home: [],
			monitors: [],
			organizations: organizationNavigation,
			billing: billingNavigation,
			settings: personalNavigation,
			resources: resourcesNavigation,
		}
	),
	website: createCategoryConfig(
		[
			{
				id: "analytics",
				name: "Analytics",
				icon: ChartBarIcon,
				production: true,
			},
			{
				id: "settings",
				name: "Settings",
				icon: GearIcon,
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
	{ pattern: "/organizations", category: "organizations" as const },
	{ pattern: "/billing", category: "billing" as const },
	{ pattern: "/feedback", category: "billing" as const },
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

const createLoadingNavigation = (
	title: string,
	titleIcon: any,
	overviewName: string,
	overviewHref: string,
	loadingName: string,
	loadingIcon: any
): NavigationSection[] => [
	createNavSection(title, titleIcon, [
		createNavItem(overviewName, ChartBarIcon, overviewHref, {
			highlight: true,
		}),
		createNavItem(loadingName, loadingIcon, overviewHref, {
			highlight: true,
			disabled: true,
		}),
	]),
];

export const createLoadingWebsitesNavigation = (): NavigationEntry[] => [
	createNavSection("Overview", SquaresFourIcon, [
		createNavItem("Home", HouseIcon, "/home", {
			highlight: true,
		}),
		createNavItem("Insights", SparkleIcon, "/insights", {
			highlight: true,
			flag: "insights",
		}),
	]),
	...createLoadingNavigation(
		"Websites",
		GlobeSimpleIcon,
		"Website Overview",
		"/websites",
		"Loading websites...",
		GlobeIcon
	),
	createNavSection("Observability", ActivityIcon, [
		createNavItem("Links", LinkIcon, "/links", {
			highlight: true,
		}),
		createNavItem("Custom Events", LightningIcon, "/events", {
			highlight: true,
		}),
	]),
];
