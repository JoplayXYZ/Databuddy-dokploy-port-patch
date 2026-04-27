# Databuddy Framework Setup

Use this file for browser analytics setup in React, Next.js, Vue, Nuxt, vanilla HTML, CMSs, and tag managers.

## React / Next.js

Use a client-capable component boundary when needed in Next.js App Router.

```tsx
import { Databuddy } from "@databuddy/sdk/react";

<Databuddy
  clientId={process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID!}
  trackWebVitals
  trackErrors
/>
```

Custom event:

```tsx
import { track } from "@databuddy/sdk";

track("signup_completed", { method: "google", source: "homepage" });
```

## Vue

Use the Vue component in `App.vue` near `RouterView` so it mounts once for the app.

```vue
<script setup>
import { Databuddy } from "@databuddy/sdk/vue";
const clientId = import.meta.env.VITE_DATABUDDY_CLIENT_ID;
</script>

<template>
  <Databuddy
    :client-id="clientId"
    track-web-vitals
    track-errors
  />
  <RouterView />
</template>
```

Vue templates use kebab-case props: `client-id`, `track-web-vitals`, `track-errors`, `track-outgoing-links`, `enable-batching`, `batch-size`, `skip-patterns`, and `mask-patterns`.

Custom event:

```vue
<script setup>
import { track } from "@databuddy/sdk";

function handleSignup() {
  track("signup_clicked", { source: "header" });
}
</script>

<template>
  <button @click="handleSignup">Sign up</button>
</template>
```

## Nuxt 3

Register the Vue component in a client-only plugin, then use runtime config in `app.vue`.

```ts
// plugins/databuddy.client.ts
import { Databuddy } from "@databuddy/sdk/vue";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component("Databuddy", Databuddy);
});
```

```vue
<!-- app.vue -->
<script setup>
const runtimeConfig = useRuntimeConfig();
</script>

<template>
  <Databuddy
    :client-id="runtimeConfig.public.databuddyClientId"
    track-web-vitals
  />
  <NuxtPage />
</template>
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      databuddyClientId: process.env.NUXT_PUBLIC_DATABUDDY_CLIENT_ID,
    },
  },
});
```

## Vanilla / CMS / GTM

```html
<script
  src="https://cdn.databuddy.cc/databuddy.js"
  data-client-id="your-client-id"
  data-track-web-vitals
  async
></script>
```

Use the CDN path for plain HTML, CMS templates, and tag managers. For strict CSP, see [troubleshooting.md](./troubleshooting.md).
