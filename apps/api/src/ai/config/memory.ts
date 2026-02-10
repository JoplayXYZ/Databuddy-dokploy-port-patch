import { redis } from "@databuddy/redis";
import type { UIMessage } from "ai";

const MESSAGE_TTL = 60 * 60 * 24 * 7; // 7 days

function chatKey(chatId: string): string {
	return `chat:messages:${chatId}`;
}

export async function getMessages(
	chatId: string,
	limit = 50
): Promise<UIMessage[]> {
	const raw = await redis.get(chatKey(chatId));
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw as string);
		const messages = Array.isArray(parsed) ? parsed : [];
		return messages.slice(-limit);
	} catch {
		return [];
	}
}

export async function saveMessages(
	chatId: string,
	messages: UIMessage[]
): Promise<void> {
	await redis.set(chatKey(chatId), JSON.stringify(messages), {
		EX: MESSAGE_TTL,
	});
}
