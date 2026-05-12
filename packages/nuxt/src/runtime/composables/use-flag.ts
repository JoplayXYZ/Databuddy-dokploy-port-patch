import { computed, type ComputedRef } from "vue";
import { useFlag as useFlagVue } from "@databuddy/sdk/vue";
import type { FlagState } from "@databuddy/sdk/vue";

const serverDefault: FlagState = {
	on: false,
	status: "loading",
	loading: true,
};

export function useFlag(key: string) {
	if (!import.meta.client) {
		return {
			on: computed(() => false) as ComputedRef<boolean>,
			loading: computed(() => true) as ComputedRef<boolean>,
			state: computed(() => serverDefault) as ComputedRef<FlagState>,
		};
	}
	// biome-ignore lint/correctness/useHookAtTopLevel: Vue composable SSR guard, not a React hook
	return useFlagVue(key);
}
