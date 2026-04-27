"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "@databuddy/ui/icons";
import { Button, cn } from "@databuddy/ui";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
	className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
	const { theme, setTheme } = useTheme();
	const currentTheme = theme ?? "system";

	const toggleTheme = () => {
		if (currentTheme === "system") {
			setTheme("light");
		} else if (currentTheme === "light") {
			setTheme("dark");
		} else {
			setTheme("system");
		}
	};

	return (
		<Button
			className={cn("relative size-8 cursor-pointer", className)}
			onClick={toggleTheme}
			size="sm"
			suppressHydrationWarning
			variant="ghost"
		>
			<SunIcon
				className={cn(
					"size-4 transition-all duration-300",
					currentTheme === "light" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
				)}
				suppressHydrationWarning
			/>
			<MoonIcon
				className={cn(
					"absolute size-4 transition-all duration-300",
					currentTheme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"
				)}
				suppressHydrationWarning
			/>
			<MonitorIcon
				className={cn(
					"absolute size-4 transition-all duration-300",
					currentTheme === "system" ? "rotate-0 scale-100" : "rotate-90 scale-0"
				)}
				suppressHydrationWarning
			/>
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
