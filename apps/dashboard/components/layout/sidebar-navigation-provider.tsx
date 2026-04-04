"use client";

import { authClient } from "@databuddy/auth/client";
import { useFlags } from "@databuddy/sdk/react";
import {
	type ReadonlyURLSearchParams,
	usePathname,
	useSearchParams,
} from "next/navigation";
import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMonitorsLight } from "@/hooks/use-monitors";
import { useAccordionStates } from "@/hooks/use-persistent-state";
import { useWebsitesLight } from "@/hooks/use-websites";
import {
	categoryConfig,
	createLoadingMonitorsNavigation,
	createLoadingWebsitesNavigation,
	createMonitorsNavigation,
	createWebsitesNavigation,
	filterCategoriesByFlags,
	filterCategoriesForRoute,
	getContextConfig,
	getDefaultCategory,
} from "./navigation/navigation-config";
import type { Category, NavigationEntry } from "./navigation/types";
import { WebsiteHeader } from "./navigation/website-header";
import { OrganizationSelector } from "./organization-selector";

interface SidebarNavigationContextValue {
	navigation: NavigationEntry[];
	categories: Category[];
	activeCategory: string;
	setCategory: (id: string) => void;
	header: ReactNode;
	currentWebsiteId: string | null | undefined;
	pathname: string;
	searchParams: ReadonlyURLSearchParams;
	accordionStates: ReturnType<typeof useAccordionStates>;
}

const SidebarNavigationContext =
	createContext<SidebarNavigationContextValue | null>(null);

export function useSidebarNavigation() {
	const ctx = use(SidebarNavigationContext);
	if (!ctx) {
		throw new Error(
			"useSidebarNavigation must be used within SidebarNavigationProvider",
		);
	}
	return ctx;
}

export function SidebarNavigationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { data: session } = authClient.useSession();
	const user = session?.user ?? null;

	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { getFlag } = useFlags();
	const isHydrated = useHydrated();
	const accordionStates = useAccordionStates();

	const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
		undefined,
	);

	const { websites, isLoading: isLoadingWebsites } = useWebsitesLight({
		enabled: user !== null,
	});
	const { monitors, isLoading: isLoadingMonitors } = useMonitorsLight({
		enabled: user !== null,
	});

	const isDemo = pathname.startsWith("/demo");
	const isWebsite = pathname.startsWith("/websites/");
	const websiteId = isDemo || isWebsite ? pathname.split("/")[2] : null;

	const currentWebsite = useMemo(
		() => (websiteId ? websites?.find((site) => site.id === websiteId) : null),
		[websiteId, websites],
	);

	const populatedConfig = useMemo(() => {
		const baseConfig = getContextConfig(pathname);
		if (baseConfig !== categoryConfig.main) return baseConfig;

		return {
			...baseConfig,
			navigationMap: {
				...baseConfig.navigationMap,
				home:
					!isHydrated || isLoadingWebsites
						? createLoadingWebsitesNavigation()
						: createWebsitesNavigation(websites),
				monitors:
					!isHydrated || isLoadingMonitors
						? createLoadingMonitorsNavigation()
						: createMonitorsNavigation(monitors),
			},
		};
	}, [
		pathname,
		isHydrated,
		isLoadingWebsites,
		websites,
		isLoadingMonitors,
		monitors,
	]);

	const categories = useMemo(
		() =>
			filterCategoriesByFlags(
				filterCategoriesForRoute(populatedConfig.categories, pathname),
				isHydrated,
				getFlag,
			),
		[populatedConfig.categories, pathname, isHydrated, getFlag],
	);

	const defaultCategory = useMemo(
		() => getDefaultCategory(pathname),
		[pathname],
	);
	const previousDefaultCategoryRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (
			previousDefaultCategoryRef.current !== undefined &&
			previousDefaultCategoryRef.current !== defaultCategory
		) {
			setSelectedCategory(undefined);
		}
		previousDefaultCategoryRef.current = defaultCategory;
	}, [defaultCategory]);

	const activeCategory = selectedCategory || defaultCategory;

	const navigation = useMemo(() => {
		const navSections =
			populatedConfig.navigationMap[
				activeCategory as keyof typeof populatedConfig.navigationMap
			] ||
			populatedConfig.navigationMap[
				populatedConfig.defaultCategory as keyof typeof populatedConfig.navigationMap
			];

		return navSections
			.map((entry) => {
				if ("items" in entry) {
					const filteredItems = entry.items.filter((item) => {
						if (item.flag) {
							const flagState = getFlag(item.flag);
							return flagState.status === "ready" && flagState.on;
						}
						return true;
					});
					return { ...entry, items: filteredItems };
				}
				return entry;
			})
			.filter((entry) => {
				if (entry.flag) {
					const flagState = getFlag(entry.flag);
					if (!(flagState.status === "ready" && flagState.on)) {
						return false;
					}
				}
				if ("items" in entry && entry.items.length === 0) {
					return false;
				}
				return true;
			});
	}, [populatedConfig, activeCategory, getFlag]);

	const header = useMemo(() => {
		if (isWebsite || isDemo) {
			return (
				<WebsiteHeader showBackButton={!isDemo} website={currentWebsite} />
			);
		}
		return <OrganizationSelector />;
	}, [isWebsite, isDemo, currentWebsite]);

	const currentWebsiteId = isWebsite || isDemo ? websiteId : undefined;

	const value = useMemo<SidebarNavigationContextValue>(
		() => ({
			navigation,
			categories,
			activeCategory,
			setCategory: setSelectedCategory,
			header,
			currentWebsiteId,
			pathname,
			searchParams,
			accordionStates,
		}),
		[
			navigation,
			categories,
			activeCategory,
			header,
			currentWebsiteId,
			pathname,
			searchParams,
			accordionStates,
		],
	);

	return (
		<SidebarNavigationContext value={value}>
			{children}
		</SidebarNavigationContext>
	);
}
