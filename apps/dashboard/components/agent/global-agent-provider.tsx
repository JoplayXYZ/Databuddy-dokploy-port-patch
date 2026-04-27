"use client";

import { generateId } from "ai";
import { usePathname } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { type Website, useWebsitesLight } from "@/hooks/use-websites";
import { getLastChatId, setLastChatId } from "./hooks/use-chat-db";

const GLOBAL_AGENT_OPEN_KEY = "databuddy-global-agent-open";
const GLOBAL_AGENT_WEBSITE_KEY = "databuddy-global-agent-website";
const WEBSITE_PATH_REGEX = /^\/websites\/([^/]+)/;
const AGENT_PATH_REGEX = /^\/websites\/[^/]+\/agent(?:\/|$)/;

interface GlobalAgentContextValue {
	chatId: string | null;
	closeDock: () => void;
	isAgentRoute: boolean;
	isAvailable: boolean;
	isLoadingWebsites: boolean;
	isOpen: boolean;
	loadChat: (chatId: string) => void;
	newChat: () => void;
	openDock: () => void;
	selectWebsite: (websiteId: string) => void;
	toggleDock: () => void;
	websiteId: string | null;
	websites: Website[];
}

const GlobalAgentContext = createContext<GlobalAgentContextValue | null>(null);

function getWebsiteIdFromPathname(pathname: string): string | null {
	const match = pathname.match(WEBSITE_PATH_REGEX);
	if (!match?.[1]) {
		return null;
	}

	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

function getStoredOpenState(): boolean {
	try {
		return window.localStorage.getItem(GLOBAL_AGENT_OPEN_KEY) === "true";
	} catch {
		return false;
	}
}

function getStoredWebsiteId(): string | null {
	try {
		return window.localStorage.getItem(GLOBAL_AGENT_WEBSITE_KEY);
	} catch {
		return null;
	}
}

function storeOpenState(isOpen: boolean) {
	try {
		window.localStorage.setItem(GLOBAL_AGENT_OPEN_KEY, String(isOpen));
	} catch {}
}

function storeWebsiteId(websiteId: string) {
	try {
		window.localStorage.setItem(GLOBAL_AGENT_WEBSITE_KEY, websiteId);
	} catch {}
}

export function GlobalAgentProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const routeWebsiteId = getWebsiteIdFromPathname(pathname);
	const isAgentRoute = AGENT_PATH_REGEX.test(pathname);
	const isAvailable = !isAgentRoute;
	const { websites, isLoading: isLoadingWebsites } = useWebsitesLight({
		enabled: isAvailable,
	});
	const [chatId, setChatId] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [hasLoadedOpenState, setHasLoadedOpenState] = useState(false);
	const [storedWebsiteId, setStoredWebsiteId] = useState<string | null>(null);

	const storedWebsiteIsValid = storedWebsiteId
		? websites.length === 0 ||
			websites.some((site) => site.id === storedWebsiteId)
		: false;
	const websiteId =
		routeWebsiteId ??
		(storedWebsiteIsValid ? storedWebsiteId : null) ??
		websites[0]?.id ??
		null;

	useEffect(() => {
		setIsOpen(getStoredOpenState());
		setStoredWebsiteId(getStoredWebsiteId());
		setHasLoadedOpenState(true);
	}, []);

	useEffect(() => {
		if (hasLoadedOpenState) {
			storeOpenState(isOpen);
		}
	}, [hasLoadedOpenState, isOpen]);

	useEffect(() => {
		if (routeWebsiteId) {
			setStoredWebsiteId(routeWebsiteId);
			storeWebsiteId(routeWebsiteId);
		}
	}, [routeWebsiteId]);

	useEffect(() => {
		if (routeWebsiteId || isLoadingWebsites || websites.length === 0) {
			return;
		}
		if (
			storedWebsiteId &&
			websites.some((site) => site.id === storedWebsiteId)
		) {
			return;
		}
		const fallbackWebsiteId = websites[0]?.id;
		if (!fallbackWebsiteId) {
			return;
		}
		setStoredWebsiteId(fallbackWebsiteId);
		storeWebsiteId(fallbackWebsiteId);
	}, [isLoadingWebsites, routeWebsiteId, storedWebsiteId, websites]);

	useEffect(() => {
		if (!websiteId) {
			setChatId(null);
			return;
		}

		const nextChatId = getLastChatId(websiteId) ?? generateId();
		setLastChatId(websiteId, nextChatId);
		setChatId(nextChatId);
	}, [websiteId]);

	const selectWebsite = useCallback((nextWebsiteId: string) => {
		setStoredWebsiteId(nextWebsiteId);
		storeWebsiteId(nextWebsiteId);

		const nextChatId = getLastChatId(nextWebsiteId) ?? generateId();
		setLastChatId(nextWebsiteId, nextChatId);
		setChatId(nextChatId);
		setIsOpen(true);
	}, []);

	const ensureChat = useCallback(() => {
		if (!websiteId) {
			return null;
		}

		const nextChatId = chatId ?? getLastChatId(websiteId) ?? generateId();
		setLastChatId(websiteId, nextChatId);
		setChatId(nextChatId);
		return nextChatId;
	}, [chatId, websiteId]);

	const openDock = useCallback(() => {
		if (!isAvailable) {
			return;
		}
		ensureChat();
		setIsOpen(true);
	}, [ensureChat, isAvailable]);

	const closeDock = useCallback(() => {
		setIsOpen(false);
	}, []);

	const toggleDock = useCallback(() => {
		if (!isAvailable) {
			return;
		}
		if (isOpen) {
			setIsOpen(false);
			return;
		}
		ensureChat();
		setIsOpen(true);
	}, [ensureChat, isAvailable, isOpen]);

	const loadChat = useCallback(
		(nextChatId: string) => {
			if (!websiteId) {
				return;
			}
			setLastChatId(websiteId, nextChatId);
			setChatId(nextChatId);
			setIsOpen(true);
		},
		[websiteId]
	);

	const newChat = useCallback(() => {
		if (!websiteId) {
			return;
		}
		loadChat(generateId());
	}, [loadChat, websiteId]);

	const value = useMemo(
		(): GlobalAgentContextValue => ({
			chatId,
			closeDock,
			isAgentRoute,
			isAvailable,
			isLoadingWebsites,
			isOpen,
			loadChat,
			newChat,
			openDock,
			selectWebsite,
			toggleDock,
			websiteId,
			websites,
		}),
		[
			chatId,
			closeDock,
			isAgentRoute,
			isAvailable,
			isLoadingWebsites,
			isOpen,
			loadChat,
			newChat,
			openDock,
			selectWebsite,
			toggleDock,
			websiteId,
			websites,
		]
	);

	return (
		<GlobalAgentContext.Provider value={value}>
			{children}
		</GlobalAgentContext.Provider>
	);
}

export function useGlobalAgent() {
	const context = useContext(GlobalAgentContext);
	if (!context) {
		throw new Error("useGlobalAgent must be used within GlobalAgentProvider");
	}
	return context;
}
