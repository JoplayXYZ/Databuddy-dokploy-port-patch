import "server-only";

import type { AppRouter } from "@databuddy/rpc";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { headers } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const link = new RPCLink({
	url: `${API_URL}/rpc`,
	headers: async () => {
		const incoming = await headers();
		const cookie = incoming.get("cookie");
		return cookie ? { cookie } : {};
	},
});

const serverClient: RouterClient<AppRouter> = createORPCClient(link);

export const orpcServer = createTanstackQueryUtils(serverClient);
