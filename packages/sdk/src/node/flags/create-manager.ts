import type { FlagsConfig } from "@/core/flags/types";
import { ServerFlagsManager } from "./flags-manager";

/**
 * @example
 * ```typescript
 * import { createServerFlagsManager } from '@databuddy/sdk/node';
 *
 * const manager = createServerFlagsManager({
 *   clientId: process.env.DATABUDDY_CLIENT_ID!,
 * });
 *
 * await manager.waitForInit();
 * const flag = await manager.getFlag('my-feature');
 * ```
 */
export function createServerFlagsManager(
	config: FlagsConfig
): ServerFlagsManager {
	return new ServerFlagsManager({ config });
}
