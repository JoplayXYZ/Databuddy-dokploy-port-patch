import { FeedbackPrompt } from "@/components/feedback-prompt";
import { Sidebar } from "@/components/layout/sidebar";
import {
	SidebarInset,
	SidebarLayout,
} from "@/components/layout/sidebar-layout";
import { SidebarNavigationProvider } from "@/components/layout/sidebar-navigation-provider";
import { TopBar, TopBarProvider } from "@/components/layout/top-bar";
import { BillingProvider } from "@/components/providers/billing-provider";
import { SessionGuard } from "@/components/providers/session-guard";
import { CommandSearchProvider } from "@/components/ui/command-search";
import { AutumnProvider } from "autumn-js/react";
import { Suspense } from "react";

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AutumnProvider
			backendUrl={process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
			includeCredentials
		>
			<BillingProvider>
				<CommandSearchProvider>
					<SidebarNavigationProvider>
						<SessionGuard>
							<SidebarLayout>
								<TopBarProvider>
									<div className="flex min-h-0 flex-1 flex-col overflow-hidden text-foreground">
										<Suspense fallback={null}>
											<Sidebar />
										</Suspense>
										<SidebarInset>
											<TopBar />
											<div className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden overscroll-y-none pt-12 md:pt-0">
												{children}
											</div>
										</SidebarInset>
										<FeedbackPrompt />
									</div>
								</TopBarProvider>
							</SidebarLayout>
						</SessionGuard>
					</SidebarNavigationProvider>
				</CommandSearchProvider>
			</BillingProvider>
		</AutumnProvider>
	);
}
