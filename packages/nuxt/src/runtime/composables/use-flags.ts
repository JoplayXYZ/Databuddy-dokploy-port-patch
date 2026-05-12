import { useFlags as useFlagsVue } from "@databuddy/sdk/vue";
import type { FlagsConfig, FlagState } from "@databuddy/sdk/vue";

const serverNoop = {
	getFlag: (_key: string): FlagState => ({
		on: false,
		status: "loading" as const,
		loading: true,
	}),
	fetchAllFlags: () => Promise.resolve(),
	updateUser: (_user: FlagsConfig["user"]) => {},
	refresh: (_forceClear?: boolean) => Promise.resolve(),
	updateConfig: (_config: FlagsConfig) => {},
	memoryFlags: {} as Record<string, never>,
};

export function useFlags() {
	if (!import.meta.client) {
		return serverNoop;
	}
	// biome-ignore lint/correctness/useHookAtTopLevel: Vue composable SSR guard, not a React hook
	return useFlagsVue();
}
