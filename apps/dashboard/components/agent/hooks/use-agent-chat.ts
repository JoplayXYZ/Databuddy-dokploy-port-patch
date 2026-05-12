"use client";

import { publicConfig } from "@databuddy/env/public";

import { DefaultChatTransport, type UIMessage } from "ai";
import { useAtomValue } from "jotai";
import { useMemo, useRef } from "react";
import { normalizeAIComponentMessages } from "@/lib/ai-components/message-parts";
import { agentThinkingAtom, agentTierAtom } from "../agent-atoms";

const API_URL = publicConfig.urls.api;

export function useAgentChatTransport(chatId: string, websiteId: string) {
	const thinking = useAtomValue(agentThinkingAtom);
	const tier = useAtomValue(agentTierAtom);
	const thinkingRef = useRef(thinking);
	const tierRef = useRef(tier);
	thinkingRef.current = thinking;
	tierRef.current = tier;

	return useMemo(
		() =>
			new DefaultChatTransport({
				api: `${API_URL}/v1/agent/chat`,
				credentials: "include",
				prepareSendMessagesRequest({ messages }) {
					const normalizedMessages = normalizeAIComponentMessages(
						messages as UIMessage[]
					);
					return {
						body: {
							id: chatId,
							websiteId,
							messages: normalizedMessages,
							timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
							thinking: thinkingRef.current,
							tier: tierRef.current,
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
