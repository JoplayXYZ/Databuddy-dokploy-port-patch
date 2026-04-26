"use client";

import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { authClient } from "@databuddy/auth/client";
import { Avatar } from "@/components/ds/avatar";
import { Button } from "@/components/ds/button";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { Skeleton } from "@databuddy/ui";
import { Tooltip } from "@databuddy/ui";
import {
	BugIcon,
	CalendarIcon,
	EnvelopeIcon,
	MagnifyingGlassIcon,
	MsgContentIcon,
} from "@databuddy/ui/icons";
import { useCommandSearchOpenAction } from "@/components/ui/command-search";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { PendingInvitationsButton } from "./pending-invitations-button";
import { getInitials, ProfileDropdownContent } from "./profile-button-client";
import { SidebarTrigger } from "./sidebar-layout";

type SlotMap = Map<string, ReactNode>;
type Listener = () => void;

interface TopBarStore {
	getSlot: (name: string) => ReactNode;
	removeSlot: (name: string, id: string) => void;
	setSlot: (name: string, id: string, node: ReactNode) => void;
	subscribe: (listener: Listener) => () => void;
}

function createTopBarStore(): TopBarStore {
	const slots: Record<string, SlotMap> = {};
	const listeners = new Set<Listener>();

	function notify() {
		for (const l of listeners) {
			l();
		}
	}

	return {
		getSlot(name: string) {
			const map = slots[name];
			if (!map || map.size === 0) {
				return null;
			}
			return Array.from(map.values()).at(-1) ?? null;
		},
		setSlot(name: string, id: string, node: ReactNode) {
			if (!slots[name]) {
				slots[name] = new Map();
			}
			slots[name].set(id, node);
			notify();
		},
		removeSlot(name: string, id: string) {
			slots[name]?.delete(id);
			if (slots[name]?.size === 0) {
				delete slots[name];
			}
			notify();
		},
		subscribe(listener: Listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

const TopBarStoreContext = createContext<TopBarStore | null>(null);

const topBarIconButtonClassName =
	"flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 transition-colors duration-(--duration-quick) ease-(--ease-smooth) hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

function useStore() {
	const store = use(TopBarStoreContext);
	if (!store) {
		throw new Error("TopBar slot must be used within TopBarProvider");
	}
	return store;
}

function useStoreSlot(name: string): ReactNode {
	const store = useStore();
	const [, forceUpdate] = useState(0);

	useEffect(() => store.subscribe(() => forceUpdate((n) => n + 1)), [store]);

	return store.getSlot(name);
}

function useTopBarSlot(name: string, content: ReactNode) {
	const store = useStore();
	const id = useId();
	const contentRef = useRef(content);
	contentRef.current = content;

	useEffect(() => {
		store.setSlot(name, id, contentRef.current);
		return () => store.removeSlot(name, id);
	}, [store, name, id]);

	useEffect(() => {
		store.setSlot(name, id, content);
	}, [store, name, id, content]);
}

function TopBarTitle({ children }: { children: ReactNode }) {
	const content = (
		<div className="flex min-w-0 items-center gap-2 [&_h1]:truncate [&_h1]:font-semibold [&_h1]:text-sm">
			{children}
		</div>
	);
	useTopBarSlot("title", content);
	return null;
}

function TopBarActions({ children }: { children: ReactNode }) {
	const content = (
		<div className="flex min-w-0 items-center gap-1.5">{children}</div>
	);
	useTopBarSlot("actions", content);
	return null;
}

interface BreadcrumbItem {
	href?: string;
	label: string;
}

function TopBarBreadcrumbs({
	items,
	icon,
}: {
	icon?: ReactNode;
	items: BreadcrumbItem[];
}) {
	const content = (
		<nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-2">
			{icon && (
				<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground/60">
					{icon}
				</span>
			)}
			<ol className="flex min-w-0 items-center gap-1.5">
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					return (
						<li className="flex min-w-0 items-center gap-1.5" key={item.label}>
							{i > 0 && (
								<span className="shrink-0 text-sidebar-foreground/30">/</span>
							)}
							{isLast || !item.href ? (
								<span className="truncate font-semibold text-foreground text-sm">
									{item.label}
								</span>
							) : (
								<a
									className="truncate text-sidebar-foreground/55 text-sm hover:text-sidebar-foreground"
									href={item.href}
								>
									{item.label}
								</a>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
	useTopBarSlot("title", content);
	return null;
}

export function TopBarProvider({ children }: { children: ReactNode }) {
	const storeRef = useRef<TopBarStore | null>(null);
	if (!storeRef.current) {
		storeRef.current = createTopBarStore();
	}

	return (
		<TopBarStoreContext value={storeRef.current}>{children}</TopBarStoreContext>
	);
}

function HelpMenu() {
	const router = useRouter();

	return (
		<DropdownMenu>
			<Tooltip content="Help & feedback" side="bottom">
				<DropdownMenu.Trigger
					aria-label="Help & feedback"
					className={topBarIconButtonClassName}
					render={<button type="button" />}
				>
					<MsgContentIcon className="size-5 shrink-0" />
				</DropdownMenu.Trigger>
			</Tooltip>
			<DropdownMenu.Content align="end" className="w-48">
				<DropdownMenu.Item onClick={() => router.push("/feedback")}>
					<MsgContentIcon className="size-4 shrink-0" />
					Feedback
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onClick={() => window.open("mailto:support@databuddy.cc", "_self")}
				>
					<EnvelopeIcon className="size-4 shrink-0" />
					Contact Us
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onClick={() =>
						window.open(
							"https://github.com/databuddy-analytics/Databuddy/issues",
							"_blank"
						)
					}
				>
					<BugIcon className="size-4 shrink-0" />
					Report a Bug
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					onClick={() =>
						window.open("https://cal.com/databuddy/demo", "_blank")
					}
				>
					<CalendarIcon className="size-4 shrink-0" />
					Book a Meeting
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

function TopBarUserButton() {
	const { data: session, isPending } = authClient.useSession();
	const user = session?.user ?? null;
	const [isOpen, setIsOpen] = useState(false);

	if (isPending) {
		return <Skeleton className="size-7 shrink-0 rounded-full" />;
	}

	if (!user) {
		return null;
	}

	return (
		<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip content={user.email ?? "Account"} side="bottom">
				<DropdownMenu.Trigger
					aria-label="Profile menu"
					className={cn(
						topBarIconButtonClassName,
						"rounded-full p-0 hover:bg-transparent hover:opacity-80"
					)}
					render={<button type="button" />}
				>
					<Avatar
						alt={user.name || "User"}
						className="size-7"
						fallback={getInitials(user.name, user.email)}
						src={user.image || undefined}
					/>
				</DropdownMenu.Trigger>
			</Tooltip>
			<ProfileDropdownContent
				align="end"
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				side="bottom"
				user={user}
			/>
		</DropdownMenu>
	);
}

export function TopBar() {
	const titleContent = useStoreSlot("title");
	const actionsContent = useStoreSlot("actions");
	const [hasMounted, setHasMounted] = useState(false);
	const openSearch = useCommandSearchOpenAction();

	useEffect(() => {
		setHasMounted(true);
	}, []);

	return (
		<header className="sticky top-0 z-40 hidden h-12 shrink-0 items-center border-sidebar-border/60 border-b bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:flex">
			<div className="flex h-full w-full min-w-0 items-center gap-2 px-3">
				<SidebarTrigger />

				<div className="h-5 w-px shrink-0 bg-sidebar-border/50" />

				<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
					{hasMounted ? titleContent : null}
				</div>

				{hasMounted && actionsContent ? (
					<div className="flex min-w-0 shrink items-center overflow-hidden">
						{actionsContent}
					</div>
				) : null}

				<div className="flex shrink-0 items-center gap-1 border-sidebar-border/50 border-l pl-2">
					<Button
						aria-label="Search"
						className="h-8 min-w-9 justify-start gap-2 rounded-md px-2.5 text-sidebar-foreground/65 hover:text-sidebar-foreground lg:min-w-40"
						onClick={() => openSearch()}
						size="sm"
						variant="secondary"
					>
						<MagnifyingGlassIcon className="size-4" />
						<span className="hidden text-xs lg:inline">Search…</span>
						<kbd className="ml-auto hidden rounded border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-foreground/50 xl:inline">
							⌘K
						</kbd>
					</Button>
					<HelpMenu />
					{hasMounted && <PendingInvitationsButton />}
					{hasMounted && <TopBarUserButton />}
				</div>
			</div>
		</header>
	);
}

TopBar.Title = TopBarTitle;
TopBar.Actions = TopBarActions;
TopBar.Breadcrumbs = TopBarBreadcrumbs;
