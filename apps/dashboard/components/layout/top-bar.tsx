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
import { Button } from "@/components/ds/button";
import { useCommandSearchOpenAction } from "@/components/ui/command-search";
import { PendingInvitationsButton } from "./pending-invitations-button";
import { SidebarTrigger } from "./sidebar-layout";
import { MagnifyingGlassIcon, MsgContentIcon } from "@/components/icons/nucleo";
import Link from "next/link";

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
	useTopBarSlot("title", children);
	return null;
}

function TopBarActions({ children }: { children: ReactNode }) {
	useTopBarSlot("actions", children);
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

export function TopBar() {
	const titleContent = useStoreSlot("title");
	const actionsContent = useStoreSlot("actions");
	const [hasMounted, setHasMounted] = useState(false);
	const openSearch = useCommandSearchOpenAction();

	useEffect(() => {
		setHasMounted(true);
	}, []);

	return (
		<header className="sticky top-0 z-40 hidden h-12 shrink-0 items-center border-sidebar-border/50 border-b bg-sidebar md:flex">
			<div className="flex h-full w-full items-center gap-3 px-3">
				<SidebarTrigger />

				<div className="flex min-w-0 flex-1 items-center gap-2">
					{hasMounted ? titleContent : null}
				</div>

				<div className="flex items-center gap-2">
					{hasMounted ? actionsContent : null}
				</div>

				<div className="flex items-center gap-1.5">
					<Button
						aria-label="Search"
						className="h-8 gap-2 px-3 text-muted-foreground"
						onClick={() => openSearch()}
						variant="secondary"
					>
						<MagnifyingGlassIcon className="size-4" />
						<span className="text-xs">Search…</span>
						<kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
							⌘K
						</kbd>
					</Button>
					<Button
						aria-label="Feedback"
						asChild
						className="text-muted-foreground"
						size="sm"
						variant="ghost"
					>
						<Link href="/feedback">
							<MsgContentIcon className="size-4 shrink-0" />
						</Link>
					</Button>
					{hasMounted && <PendingInvitationsButton />}
				</div>
			</div>
		</header>
	);
}

TopBar.Title = TopBarTitle;
TopBar.Actions = TopBarActions;
