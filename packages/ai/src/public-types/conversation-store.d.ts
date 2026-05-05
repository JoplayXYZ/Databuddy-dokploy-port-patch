export interface ConversationMessage {
	content: string;
	role: "user" | "assistant";
}

export declare function getConversationHistory(
	conversationId: string,
	userId: string | null,
	apiKey: { id: string } | null
): Promise<ConversationMessage[]>;

export declare function appendToConversation(
	conversationId: string,
	userId: string | null,
	apiKey: { id: string } | null,
	userMessage: string,
	assistantMessage: string,
	existingMessages?: ConversationMessage[]
): Promise<void>;
