export type RouteLabel = "simple" | "complex";

export interface RouteMessage {
	parts?: Array<{ type?: string }>;
}

const EXPLICIT_SIMPLE =
	/^(?:hi|hey|hello|yo|sup|wassup|what's up|thanks?|thx|ty|ok(?:ay)?|cool|nice|great|awesome|got it|huh|what\??|what the (?:heck|hell|fuck)|wtf|lol|lmao|bye|cheers|nvm|never ?mind|no problem|np|alright|sure|yep|yeah|yup|nope|nah|no)[\s.!?]*$/i;

const DATA_INTENT =
	/\b(show|list|find|fetch|query|pull|get (?:me|the|all|some|total|last|today|yesterday)|analy[sz]e|analysis|compare|comparison|breakdown|trend|funnel|goal|link|chart|graph|metric|event|traffic|visitor|pageview|session|bounce|revenue|conversion|report|count|sql|select|rate|performance|error|referrer|country|device|browser|campaign|utm|cohort|retention|vitals|uptime|top|most|least|highest|lowest|over time|vs|versus|week|month|day)\b/i;

const QUESTION_DATA =
	/\b(how many|how much|what (?:is|are|was|were) (?:the|my)|which|where|who|when) /i;

export function routeMessage(text: string): RouteLabel {
	const trimmed = text.trim();
	if (!trimmed) {
		return "complex";
	}
	if (trimmed.length <= 40 && EXPLICIT_SIMPLE.test(trimmed)) {
		return "simple";
	}
	if (
		trimmed.length <= 80 &&
		!DATA_INTENT.test(trimmed) &&
		!QUESTION_DATA.test(trimmed)
	) {
		return "simple";
	}
	return "complex";
}

export function hasToolHistory(messages: RouteMessage[]): boolean {
	return messages.some((message) =>
		message.parts?.some((part) => part.type?.startsWith("tool-"))
	);
}

export function selectModelKeyForRoute(
	routeLabel: RouteLabel,
	messages: RouteMessage[]
): "fast" | "analytics" {
	if (routeLabel === "simple" && !hasToolHistory(messages)) {
		return "fast";
	}
	return "analytics";
}
