"use client";

import { Avatar } from "@/components/ds/avatar";
import { AgentChatSurface } from "@/components/agent/agent-chat-surface";
import { AgentCreditBalance } from "@/components/agent/agent-credit-balance";
import { ChatHistory } from "@/components/agent/chat-history";
import { NewChatButton } from "@/components/agent/new-chat-button";
import { TopBar } from "@/components/layout/top-bar";

interface AgentPageContentProps {
	chatId: string;
	websiteId: string;
}

export function AgentPageContent({ chatId, websiteId }: AgentPageContentProps) {
	return (
		<div className="relative flex min-h-0 flex-1 overflow-hidden">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<TopBar.Title>
					<div className="flex items-center gap-2.5">
						<Avatar
							alt="Databunny avatar"
							className="size-6 rounded"
							fallback="DB"
							src="/databunny.webp"
						/>
						<h1 className="truncate font-semibold text-foreground text-sm">
							Databunny
						</h1>
						<span className="rounded border border-border/60 px-1.5 py-px font-medium text-[10px] text-muted-foreground uppercase">
							Alpha
						</span>
					</div>
				</TopBar.Title>
				<TopBar.Actions>
					<AgentCreditBalance />
					<span aria-hidden className="mx-1 h-4 w-px bg-border/60" />
					<ChatHistory websiteId={websiteId} />
					<NewChatButton websiteId={websiteId} />
				</TopBar.Actions>

				<AgentChatSurface
					autoSendPromptFromUrl
					chatId={chatId}
					websiteId={websiteId}
				/>
			</div>
		</div>
	);
}
