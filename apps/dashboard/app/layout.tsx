import "./globals.css";

import { Databuddy } from "@databuddy/sdk/react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { APP_URL } from "@/lib/app-url";
import Providers from "./providers";

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist",
	display: "swap",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: new URL(APP_URL),
	title: {
		template: "%s | Databuddy Dashboard",
		default: "Databuddy Dashboard",
	},
	description:
		"Powerful analytics dashboard for your websites. Track visitors, monitor performance, and gain insights into your audience.",
	keywords: [
		"analytics",
		"dashboard",
		"monitoring",
		"statistics",
		"web analytics",
		"tracking",
		"website insights",
		"visitor analytics",
		"performance monitoring",
		"user behavior",
	],
	authors: [{ name: "Databuddy", url: "https://www.databuddy.cc" }],
	creator: "Databuddy",
	publisher: "Databuddy",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: APP_URL,
		title: "Databuddy Dashboard",
		description:
			"Powerful analytics dashboard for your websites. Track visitors, monitor performance, and gain insights into your audience.",
		siteName: "Databuddy Dashboard",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Databuddy Dashboard Preview",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Databuddy Dashboard",
		description:
			"Powerful analytics dashboard for your websites. Track visitors, monitor performance, and gain insights into your audience.",
		images: ["/og-image.png"],
		creator: "@databuddy",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	alternates: {
		canonical: APP_URL,
	},
	appleWebApp: {
		title: "Databuddy",
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "white" },
		{ media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
	],
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	userScalable: true,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const isLocalhost = process.env.NODE_ENV === "development";

	return (
		<html
			className={`${geist.className} ${geist.variable} ${geistMono.variable} h-full overflow-hidden`}
			lang="en"
			suppressHydrationWarning
		>
			<body className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground antialiased">
				<Providers>
					<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
						{children}
					</main>
				</Providers>
				<Toaster />
				<Databuddy
					apiUrl={
						isLocalhost
							? "http://localhost:4000"
							: "https://basket.databuddy.cc"
					}
					clientId={
						isLocalhost
							? "5ced32e5-0219-4e75-a18a-ad9826f85698"
							: "3ed1fce1-5a56-4cb6-a977-66864f6d18e3"
					}
					trackAttributes={true}
					trackErrors={true}
					trackPerformance={true}
					trackWebVitals={true}
				/>
			</body>
		</html>
	);
}
