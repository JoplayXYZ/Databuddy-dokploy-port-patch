export const GUIDE_URI = "databuddy://guide";

export const MCP_INSTRUCTIONS = `Databuddy: product analytics, errors, web vitals, feature flags, links.

Pick the right tool:
- get_data — typed analytics queries (top_pages, recent_errors, error_summary, …). Batch 2-10 with queries[].
- summarize_insights / compare_metric / top_movers / detect_anomalies — pre-built insight wrappers; prefer over ask for known shapes.
- ask — open-ended NL question. Slower, needs AI_GATEWAY_API_KEY. Reuse conversationId for follow-ups.
- capabilities — tool catalog and query types (filter by category to slim).
- get_schema — ClickHouse columns. Use when a field name is uncertain.

Conventions:
- Website ref: websiteId, websiteName, or websiteDomain — any one works.
- Dates: a preset OR both from+to (YYYY-MM-DD). Defaults to last_7d. Passing only one of from/to is rejected.
- Filters: 'field' is the column name in the schema. Errors list allowed fields and suggest close matches on typos.
- Mutations (create/update/delete flag, link, folder, memory): preview with confirmed=false, then confirm with the user before confirmed=true.

For a longer reference with workflow tips and known footguns, read the ${GUIDE_URI} resource.`;

export const GUIDE_MARKDOWN = `# Databuddy MCP guide

A longer reference for callers who want more than the session-start instructions.

## Pick the tool by intent

- **Known shape** ("top pages last 7d", "recent errors") → \`get_data\` with a type from \`capabilities\`. Batch 2-10 related queries in one call.
- **Standard insight** ("what changed", "anomalies", "top movers", "compare last week") → \`summarize_insights\` / \`compare_metric\` / \`top_movers\` / \`detect_anomalies\`. Faster and cheaper than \`ask\`.
- **Open-ended question** → \`ask\`. Reuse \`conversationId\` for follow-ups.
- **Discovery** → \`capabilities\` (catalog) or \`get_schema\` (columns). Call once, remember for the session.

## Querying

- Dates: a \`preset\` OR both \`from\`+\`to\`. Default is \`last_7d\`. Don't pass only one of \`from\`/\`to\`.
- Filters are by ClickHouse column name. When unsure, peek at \`get_schema\` for the relevant section (\`events\`, \`custom_events\`, \`errors\`, \`vitals\`, \`outgoing\`).
- Token budget: prefer category summaries (\`error_summary\`, \`error_types\`) before pulling raw rows. \`recent_*\` queries default to small limits — keep them small for triage.
- Trust the error messages: unknown types suggest matches; rejected filters list allowed fields; missing dates name the missing field.

## Mutations

Always preview with \`confirmed=false\`, get explicit user approval, then run with \`confirmed=true\`. Applies to flags, links, folders, memory.

## Worth knowing

- \`error_type\` is the JS error **class** (\`Error\`, \`TypeError\`, …), not the message. Search error text with a filter on \`message\`.
- Custom events: filter \`event_name\`, \`property_key\`, \`property_value\` — don't query the raw \`properties\` JSON.
- \`recent_errors\` stack traces are capped at 1500 chars on the server.
- Tool annotations reflect mutation kind: \`readOnlyHint\` for analytics queries, \`destructiveHint\` for delete/uninstall.
`;
