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
	autoBindSuccess: "Databuddy auto-connected this channel.",
	bindFailure:
		"I couldn't bind this channel. Check that Slack is connected in Databuddy organization settings, then try `/bind` again.",
	bindSuccess:
		"*Databuddy is ready in this channel.* Mention `@Databuddy` here or DM me to ask analytics questions.",
	channelNotBound:
		"I need this channel explicitly connected first. Run `/bind` here once, then mention `@Databuddy` with any analytics question.",
	emptyMention:
		"Ask a Databuddy analytics question after the mention. Example: `@Databuddy what changed this week?`",
	slackConnectNeedsBind:
		"This looks like a Slack Connect channel. To avoid sharing analytics with external workspaces by accident, run `/bind` here only if this channel is approved for Databuddy answers.",
	missingTeam:
		"Slack did not include a workspace id for this request. Try again from a normal workspace channel.",
	missingWorkspace:
		"Databuddy is not connected to this Slack workspace yet. Open Databuddy organization settings -> Integrations -> Slack, connect the workspace, then run `/bind` in this channel.",
	noAnswer:
		"I reached Databuddy, but no answer came back. Try a narrower question, like `traffic for the last 7 days`.",
	processingReaction: "eyes",
	streamOpening: "Thinking...",
	suggestedPromptsTitle: "Start with Databuddy",
} as const;
