"use client";

import { useRouter } from "next/navigation";
import { ChatProvider } from "@/contexts/chat-context";
import { Avatar } from "@/components/ds/avatar";
import { Button } from "@/components/ds/button";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { AgentChatSurface } from "./agent-chat-surface";
import { AgentCreditBalance } from "./agent-credit-balance";
import { useGlobalAgent } from "./global-agent-provider";
import { NewChatButton } from "./new-chat-button";
import { Skeleton } from "@databuddy/ui";
import {
	CaretDownIcon,
	CheckIcon,
	GlobeSimpleIcon,
	PlusIcon,
	XMarkIcon,
} from "@databuddy/ui/icons";

export function GlobalAgentDock() {
	const { chatId, isAvailable, loadChat, websiteId } = useGlobalAgent();

	if (!isAvailable) {
		return null;
	}

	if (!(websiteId && chatId)) {
		return <GlobalAgentEmptyDock />;
	}

	return (
		<ChatProvider
			chatId={chatId}
			key={`${websiteId}:${chatId}`}
			websiteId={websiteId}
		>
			<div className="flex h-full min-h-0 w-full flex-col bg-background">
				<GlobalAgentDockHeader />
				<AgentChatSurface
					chatId={chatId}
					className="min-h-0"
					onSelectChat={loadChat}
					variant="dock"
					websiteId={websiteId}
				/>
			</div>
		</ChatProvider>
	);
}

function GlobalAgentDockHeader() {
	const { closeDock, loadChat, websiteId } = useGlobalAgent();

	if (!websiteId) {
		return null;
	}

	return (
		<div className="shrink-0 border-border/60 border-b px-3 py-2.5">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<Avatar
						alt="Databunny avatar"
						className="size-7 rounded"
						fallback="DB"
						src="/databunny.webp"
					/>
					<div className="min-w-0 flex-1">
						<h2 className="truncate font-semibold text-foreground text-sm">
							Ask Databunny
						</h2>
						<WebsitePicker />
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<AgentCreditBalance variant="compact" />
					<NewChatButton
						className="size-7"
						onNewChat={loadChat}
						websiteId={websiteId}
					/>
					<Button
						aria-label="Close Databunny"
						className="size-7"
						onClick={closeDock}
						size="icon-sm"
						variant="ghost"
					>
						<XMarkIcon className="size-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function WebsitePicker() {
	const { selectWebsite, websiteId, websites } = useGlobalAgent();
	const currentWebsite = websites.find((site) => site.id === websiteId);
	const currentLabel = currentWebsite?.domain ?? "Website";

	if (websites.length <= 1) {
		return (
			<p className="truncate text-[11px] text-muted-foreground">
				{currentLabel}
			</p>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<button
						className="-mx-1 flex h-5 max-w-full items-center gap-1 rounded px-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
						type="button"
					/>
				}
			>
				<span className="truncate">{currentLabel}</span>
				<CaretDownIcon className="size-3 shrink-0" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" className="w-56">
				<DropdownMenu.Group>
					<DropdownMenu.GroupLabel>Ask about</DropdownMenu.GroupLabel>
					{websites.map((site) => (
						<DropdownMenu.Item
							key={site.id}
							onClick={() => selectWebsite(site.id)}
						>
							<GlobeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
							<span className="min-w-0 flex-1 truncate">{site.domain}</span>
							{site.id === websiteId ? (
								<CheckIcon className="size-3.5 shrink-0" weight="bold" />
							) : null}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

function GlobalAgentEmptyDock() {
	const router = useRouter();
	const { closeDock, isLoadingWebsites } = useGlobalAgent();

	return (
		<div className="flex h-full min-h-0 w-full flex-col bg-background">
			<div className="flex shrink-0 items-center gap-2 border-border/60 border-b px-3 py-2.5">
				<Avatar
					alt="Databunny avatar"
					className="size-7 rounded"
					fallback="DB"
					src="/databunny.webp"
				/>
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-semibold text-foreground text-sm">
						Ask Databunny
					</h2>
					<p className="truncate text-[11px] text-muted-foreground">
						Global analytics assistant
					</p>
				</div>
				<Button
					aria-label="Close Databunny"
					className="size-7"
					onClick={closeDock}
					size="icon-sm"
					variant="ghost"
				>
					<XMarkIcon className="size-3.5" />
				</Button>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
				{isLoadingWebsites ? (
					<>
						<Skeleton className="size-10 rounded" />
						<Skeleton className="h-4 w-32 rounded" />
						<Skeleton className="h-3 w-48 rounded" />
					</>
				) : (
					<>
						<div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground">
							<GlobeSimpleIcon className="size-5" weight="duotone" />
						</div>
						<div className="space-y-1">
							<h3 className="font-medium text-foreground text-sm">
								No website selected
							</h3>
							<p className="text-balance text-muted-foreground text-xs">
								Add a website before asking analytics questions.
							</p>
						</div>
						<Button onClick={() => router.push("/websites")} size="sm">
							<PlusIcon className="size-4" />
							Add website
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
