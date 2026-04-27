import { Avatar, ThemeToggle } from "@databuddy/ui/client";
import { LifebuoyIcon } from "@databuddy/ui/icons";

interface StatusNavbarProps {
	logoUrl?: string | null;
	supportUrl?: string | null;
	websiteUrl?: string | null;
}

export function StatusNavbar({
	logoUrl,
	websiteUrl,
	supportUrl,
}: StatusNavbarProps) {
	const logo = logoUrl ? (
		<Avatar alt="" className="rounded" size="sm" src={logoUrl} />
	) : null;

	return (
		<div className="sticky top-0 z-30 border-border/60 border-b bg-background/80 backdrop-blur-lg">
			<nav className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4 sm:px-6">
				{logo ? (
					websiteUrl ? (
						<a
							className="transition-opacity hover:opacity-70"
							href={websiteUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							{logo}
						</a>
					) : (
						logo
					)
				) : (
					<div />
				)}

				<div className="flex items-center gap-1.5">
					{supportUrl ? (
						<a
							className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
							href={supportUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							<LifebuoyIcon className="size-3.5" />
							<span className="hidden sm:inline">Support</span>
						</a>
					) : null}
					<ThemeToggle className="flex" />
				</div>
			</nav>
		</div>
	);
}
