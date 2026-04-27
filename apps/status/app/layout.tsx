import "./globals.css";

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { STATUS_URL } from "@/lib/status-url";

const ltSuperior = localFont({
	src: [
		{ path: "../fonts/lt-superior/light.otf", weight: "300" },
		{ path: "../fonts/lt-superior/regular.otf", weight: "400" },
		{ path: "../fonts/lt-superior/medium.otf", weight: "500" },
		{ path: "../fonts/lt-superior/semibold.otf", weight: "600" },
		{ path: "../fonts/lt-superior/bold.otf", weight: "700" },
		{ path: "../fonts/lt-superior/extrabold.otf", weight: "800" },
	],
	variable: "--font-lt-superior",
	display: "swap",
});

const ltSuperiorMono = localFont({
	src: [
		{ path: "../fonts/lt-superior-mono/regular.otf", weight: "400" },
		{ path: "../fonts/lt-superior-mono/medium.otf", weight: "500" },
		{ path: "../fonts/lt-superior-mono/semibold.otf", weight: "600" },
		{ path: "../fonts/lt-superior-mono/bold.otf", weight: "700" },
	],
	variable: "--font-lt-superior-mono",
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: new URL(STATUS_URL),
	title: {
		template: "%s | Status",
		default: "System Status",
	},
	description: "Real-time system status and uptime monitoring",
	robots: { index: true, follow: true },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "white" },
		{ media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
	],
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			className={`${ltSuperior.className} ${ltSuperior.variable} ${ltSuperiorMono.variable}`}
			lang="en"
			suppressHydrationWarning
		>
			<body className="min-h-dvh bg-background text-foreground antialiased">
				{children}
			</body>
		</html>
	);
}
