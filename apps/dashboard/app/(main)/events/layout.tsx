"use client";

import {
	IconBulletListFillDuo18,
	IconChartBarTrendUpFillDuo18,
} from "nucleo-ui-fill-duo-18";
import { PageNavigation } from "@/components/layout/page-navigation";
import { EventsPageProvider } from "./_components/events-page-context";
import { EventsPageHeader } from "./_components/events-page-header";

export default function EventsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const basePath = "/events";

	return (
		<EventsPageProvider>
			<div className="flex h-full flex-col">
				<EventsPageHeader />
				<PageNavigation
					tabs={[
						{
							id: "summary",
							label: "Summary",
							href: basePath,
							icon: IconChartBarTrendUpFillDuo18,
						},
						{
							id: "stream",
							label: "Stream",
							href: `${basePath}/stream`,
							icon: IconBulletListFillDuo18,
						},
					]}
					variant="tabs"
				/>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
					{children}
				</div>
			</div>
		</EventsPageProvider>
	);
}
