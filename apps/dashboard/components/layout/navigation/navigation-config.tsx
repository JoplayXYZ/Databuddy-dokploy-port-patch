import { GATED_FEATURES } from "@databuddy/shared/types/features";
import {
	BellIcon,
	BoltLightningIcon as LightningIcon,
	BugIcon,
	ChartActivityIcon as PulseIcon,
	ChartPieIcon as ChartPieSliceIcon,
	CodeIcon,
	CreditCardIcon,
	CurrencyDollarIcon,
	EyeIcon,
	FileDownloadIcon as FileArrowDownIcon,
	FilterIcon as FunnelIcon,
	FlagIcon,
	GaugeIcon,
	GearIcon,
	GlobeIcon,
	GlobeSimpleIcon,
	HeartPulseIcon as HeartbeatIcon,
	HouseIcon,
	IdBadge2Icon as IdentificationBadgeIcon,
	LightbulbIcon,
	LinkIcon,
	LockIcon,
	MapPinIcon,
	OpenExternalIcon as ArrowSquareOutIcon,
	ReceiptIcon,
	RobotIcon,
	TargetIcon,
	TriangleWarningIcon as WarningIcon,
	UserIcon,
	UserSettingsIcon,
	Users3Icon as UsersThreeIcon,
} from "@databuddy/ui/icons";
import type { NavigationGroup, NavigationItem } from "./types";

export const createNavItem = (
	name: string,
	icon: NavigationItem["icon"],
	href: string,
	options: Partial<Omit<NavigationItem, "name" | "icon" | "href">> = {}
): NavigationItem => ({
	name,
	icon,
	href,
	rootLevel: true,
	...options,
});

export const mainNavigation: NavigationGroup[] = [
	{
		label: "",
		items: [
			createNavItem("Home", HouseIcon, "/home"),
			createNavItem("Websites", GlobeIcon, "/websites"),
			createNavItem("Insights", LightbulbIcon, "/insights"),
		],
	},
	{
		label: "Tracking",
		items: [
			createNavItem("Links", LinkIcon, "/links"),
			createNavItem("Custom Events", LightningIcon, "/events"),
		],
	},
	{
		label: "Monitoring",
		flag: "monitors",
		items: [
			createNavItem("Monitors", HeartbeatIcon, "/monitors"),
			createNavItem("Status Pages", GlobeSimpleIcon, "/monitors/status-pages"),
		],
	},
	{
		label: "",
		pinToBottom: true,
		items: [createNavItem("Settings", GearIcon, "/organizations/settings")],
	},
];

export const websiteNavigation: NavigationGroup[] = [
	{
		back: { href: "/websites", label: "Websites" },
		label: "",
		items: [
			createNavItem("Dashboard", ChartPieSliceIcon, "", { rootLevel: false }),
			createNavItem("Audience", UsersThreeIcon, "/audience", {
				rootLevel: false,
			}),
			createNavItem("Error Tracking", BugIcon, "/errors", {
				rootLevel: false,
				gatedFeature: GATED_FEATURES.ERROR_TRACKING,
			}),
		],
	},
	{
		label: "Performance",
		items: [
			createNavItem("Web Vitals", GaugeIcon, "/vitals", {
				rootLevel: false,
				gatedFeature: GATED_FEATURES.WEB_VITALS,
			}),
			createNavItem("Geographic", MapPinIcon, "/map", {
				rootLevel: false,
				gatedFeature: GATED_FEATURES.GEOGRAPHIC,
			}),
			createNavItem("Anomalies", WarningIcon, "/anomalies", {
				rootLevel: false,
				alpha: true,
				flag: "anomalies",
			}),
			createNavItem("Pulse", PulseIcon, "/pulse", {
				rootLevel: false,
				flag: "pulse",
				alpha: true,
			}),
		],
	},
	{
		label: "Product",
		items: [
			createNavItem("Events", LightningIcon, "/events", {
				rootLevel: false,
			}),
			createNavItem("Users", IdentificationBadgeIcon, "/users", {
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
		],
	},
	{
		label: "AI",
		items: [
			createNavItem("Databunny", RobotIcon, "/agent", {
				alpha: true,
				rootLevel: false,
			}),
		],
	},
	{
		label: "Settings",
		pinToBottom: true,
		items: [
			createNavItem("General", GearIcon, "/settings/general", {
				rootLevel: false,
			}),
			createNavItem("Security", LockIcon, "/settings/security", {
				rootLevel: false,
			}),
			createNavItem("Transfer", ArrowSquareOutIcon, "/settings/transfer", {
				rootLevel: false,
			}),
			createNavItem("Data Export", FileArrowDownIcon, "/settings/export", {
				rootLevel: false,
			}),
			createNavItem("Setup", CodeIcon, "/settings/tracking", {
				rootLevel: false,
			}),
		],
	},
];

export const settingsNavigation: NavigationGroup[] = [
	{
		back: { href: "/home", label: "Home" },
		label: "Organization",
		items: [
			createNavItem("General", GearIcon, "/organizations/settings"),
			createNavItem("Members", UserIcon, "/organizations/members"),
			createNavItem("Billing", CreditCardIcon, "/billing"),
			createNavItem("Plans", CurrencyDollarIcon, "/billing/plans"),
			createNavItem("Invoices", ReceiptIcon, "/billing/history"),
		],
	},
	{
		label: "Account",
		items: [
			createNavItem("Profile", UserSettingsIcon, "/settings/account"),
			createNavItem("Appearance", EyeIcon, "/settings/appearance"),
			createNavItem("Notifications", BellIcon, "/settings/notifications"),
		],
	},
];

const SETTINGS_PREFIXES = [
	"/organizations",
	"/billing",
	"/settings",
	"/feedback",
] as const;

export type NavContext = "main" | "settings" | "website";

const CONTEXT_DEPTH: Record<NavContext, number> = {
	main: 0,
	settings: 1,
	website: 1,
};

export function getNavContext(pathname: string): NavContext {
	if (pathname.startsWith("/websites/") || pathname.startsWith("/demo/")) {
		return "website";
	}
	if (SETTINGS_PREFIXES.some((p) => pathname.startsWith(p))) {
		return "settings";
	}
	return "main";
}

export function getNavigation(pathname: string): NavigationGroup[] {
	const ctx = getNavContext(pathname);
	if (ctx === "website") {
		return websiteNavigation;
	}
	if (ctx === "settings") {
		return settingsNavigation;
	}
	return mainNavigation;
}

export function getNavDirection(
	prev: NavContext,
	next: NavContext
): "left" | "right" | null {
	if (prev === next) {
		return null;
	}
	return CONTEXT_DEPTH[next] > CONTEXT_DEPTH[prev] ? "left" : "right";
}
