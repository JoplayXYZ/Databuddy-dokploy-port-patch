export const SLACK_SUGGESTED_PROMPTS = [
	{
		message:
			"What changed in traffic, conversions, and top pages over the last 7 days?",
		title: "Weekly changes",
	},
	{
		message: "What looks unusual in our analytics today?",
		title: "Find anomalies",
	},
	{
		message:
			"Which referrers and campaigns are driving the best traffic this week?",
		title: "Channel performance",
	},
] as const;

export const SLACK_COPY = {
	agentFailure:
		"I hit a snag while asking Databuddy. Try again in a moment; if it keeps happening, reconnect Slack from Databuddy organization settings.",
	assistantGreeting:
		"I can help with traffic, referrers, pages, conversions, campaigns, and product usage. Ask naturally and I will use your Databuddy analytics context.",
	bindFailure:
		"I couldn't bind this channel. Check that Slack is connected in Databuddy organization settings, then try `/bind` again.",
	bindSuccess:
		"*Databuddy is ready in this channel.* Mention `@Databuddy` here or DM me to ask analytics questions.",
	channelNotBound:
		"This channel is not bound to Databuddy yet. Run `/bind` in this channel first, then mention `@Databuddy` with any analytics question.",
	emptyMention:
		"Ask a Databuddy analytics question after the mention. Example: `@Databuddy what changed this week?`",
	missingTeam:
		"Slack did not include a workspace id for this request. Try again from a normal workspace channel.",
	missingWorkspace:
		"Databuddy is not connected to this Slack workspace yet. Open Databuddy organization settings -> Integrations -> Slack, connect the workspace, then run `/bind` in this channel.",
	noAnswer:
		"I reached Databuddy, but no answer came back. Try a narrower question, like `traffic for the last 7 days`.",
	suggestedPromptsTitle: "Start with Databuddy",
} as const;
