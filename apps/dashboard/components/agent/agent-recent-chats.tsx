"use client";

import { Button } from "@/components/ds/button";
import { dayjs } from "@databuddy/ui";
import { ChatTextIcon } from "@databuddy/ui/icons";
import { useChatList } from "./hooks/use-chat-db";

interface AgentRecentChatsProps {
	currentChatId: string;
	onSelectChat?: (chatId: string) => void;
	websiteId: string;
}

export function AgentRecentChats({
	currentChatId,
	onSelectChat,
	websiteId,
}: AgentRecentChatsProps) {
	const { chats, isLoading } = useChatList(websiteId);
	const recent = chats.filter((chat) => chat.id !== currentChatId).slice(0, 3);

	if (isLoading || recent.length === 0 || !onSelectChat) {
		return null;
	}

	return (
		<div className="shrink-0 px-2 pb-1">
			<div className="mb-1 flex items-center justify-between px-1">
				<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
					Recent
				</span>
			</div>
			<div className="space-y-0.5">
				{recent.map((chat) => (
					<Button
						className="h-8 w-full justify-start gap-2 px-2 text-left text-muted-foreground hover:text-foreground"
						key={chat.id}
						onClick={() => onSelectChat(chat.id)}
						size="sm"
						variant="ghost"
					>
						<ChatTextIcon className="size-3.5 shrink-0" weight="duotone" />
						<span className="min-w-0 flex-1 truncate text-xs">
							{chat.title}
						</span>
						<span className="shrink-0 text-[10px] text-muted-foreground/70">
							{dayjs(chat.updatedAt).fromNow()}
						</span>
					</Button>
				))}
			</div>
		</div>
	);
}
