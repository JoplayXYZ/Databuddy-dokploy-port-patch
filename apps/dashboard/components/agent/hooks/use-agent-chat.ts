"use client";

import { DefaultChatTransport } from "ai";
import { useAtomValue } from "jotai";
import { useMemo, useRef } from "react";
import { agentThinkingAtom } from "../agent-atoms";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useAgentChatTransport(chatId: string, websiteId: string) {
	const thinking = useAtomValue(agentThinkingAtom);
	const thinkingRef = useRef(thinking);
	thinkingRef.current = thinking;

	return useMemo(
		() =>
			new DefaultChatTransport({
				api: `${API_URL}/v1/agent/chat`,
				credentials: "include",
				prepareSendMessagesRequest({ messages }) {
					return {
						body: {
							id: chatId,
							websiteId,
							messages,
							timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
							thinking: thinkingRef.current,
						},
					};
				},
				prepareReconnectToStreamRequest({ id }) {
					return {
						api: `${API_URL}/v1/agent/chat/${id}/stream`,
						credentials: "include",
					};
				},
			}),
		[chatId, websiteId]
	);
}
