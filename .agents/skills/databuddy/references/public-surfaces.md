# Databuddy Public Surfaces

Use this as the routing map for exact package, env, endpoint, scope, or snippet details. Do not include these local file paths in customer-facing answers.

## Surface Matrix

| Surface | Prefer | Credential | Endpoint | Details |
| --- | --- | --- | --- | --- |
| React / Next.js browser tracking | `@databuddy/sdk/react` | `NEXT_PUBLIC_DATABUDDY_CLIENT_ID` or `clientId` prop | script from CDN, events to basket | [frameworks.md](./frameworks.md) |
| Vue / Nuxt browser tracking | `@databuddy/sdk/vue` | `VITE_DATABUDDY_CLIENT_ID`, `NUXT_PUBLIC_DATABUDDY_CLIENT_ID`, or prop | script from CDN, events to basket | [frameworks.md](./frameworks.md) |
| Vanilla / CMS / GTM | CDN script | `data-client-id` | `https://cdn.databuddy.cc/databuddy.js` then basket | [frameworks.md](./frameworks.md) |
| Browser helpers | `@databuddy/sdk` helpers | browser `clientId` from installed tracker | local/session storage, URL params, basket | [server-events.md](./server-events.md) |
| Server custom events | `@databuddy/sdk/node` | `DATABUDDY_API_KEY` plus optional `DATABUDDY_WEBSITE_ID` | `https://basket.databuddy.cc/track` | [server-events.md](./server-events.md) |
| Raw event ingestion | HTTP/fetch/curl | API key or website id | `POST https://basket.databuddy.cc/track` | [server-events.md](./server-events.md) |
| Feature flag evaluation | React/Vue hooks or `createServerFlagsManager` | website `clientId` | `https://api.databuddy.cc/public/v1/flags/bulk` | [feature-flags.md](./feature-flags.md) |
| DevTools overlay | `@databuddy/devtools` | optional `manage:flags` API key for flag management | reads SDK globals; admin calls to API host | [devtools.md](./devtools.md) |
| REST analytics query | HTTP/fetch/curl | `DATABUDDY_API_KEY` | `https://api.databuddy.cc/v1/query...` | below |

## Scopes

- `read:data`: query analytics and list accessible websites.
- `track:events`: send server-side custom events to `/track`.
- `manage:flags`: manage flag definitions; not required for public flag evaluation with `clientId`.

## Install

```bash
bun add @databuddy/sdk
npm install @databuddy/sdk
pnpm add @databuddy/sdk
yarn add @databuddy/sdk
```

DevTools is a separate dev dependency:

```bash
bun add -d @databuddy/devtools
```

## REST Query

```bash
curl -H "x-api-key: dbdy_your_api_key" \
  https://api.databuddy.cc/v1/query/websites
```

Query API uses the main API host. Event ingestion uses basket. Feature flag evaluation uses the main API host public flag routes.

## Read Next

- Framework setup: [frameworks.md](./frameworks.md)
- Server events and attribution: [server-events.md](./server-events.md)
- Feature flags and experiments: [feature-flags.md](./feature-flags.md)
- DevTools overlay: [devtools.md](./devtools.md)
- Event and metric planning: [instrumentation-planning.md](./instrumentation-planning.md)
- Troubleshooting and CSP: [troubleshooting.md](./troubleshooting.md)

## Source Docs

- React/Next: `apps/docs/content/docs/sdk/react.mdx`, `apps/docs/content/docs/Integrations/nextjs.mdx`
- Vue: `apps/docs/content/docs/sdk/vue.mdx`
- Vanilla/CDN: `apps/docs/content/docs/sdk/vanilla-js.mdx`
- Node: `apps/docs/content/docs/sdk/node.mdx`
- Feature flags: `apps/docs/content/docs/sdk/feature-flags.mdx`, `apps/docs/content/docs/sdk/server-flags.mdx`
- REST API: `apps/docs/content/docs/api/index.mdx`, `apps/docs/content/docs/api/authentication.mdx`, `apps/docs/content/docs/api/events.mdx`
