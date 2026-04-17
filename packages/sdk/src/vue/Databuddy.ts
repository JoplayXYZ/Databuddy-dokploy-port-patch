import { defineComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { createScript, type DatabuddyConfig, isScriptInjected } from "@/core";
import { detectClientId, type IsOptional } from "@/utils";

export const Databuddy = defineComponent({
	props: {} as {
		[key in keyof DatabuddyConfig]: {
			type: NonNullable<DatabuddyConfig[key]> extends string
				? StringConstructor
				: NonNullable<DatabuddyConfig[key]> extends number
					? NumberConstructor
					: NonNullable<DatabuddyConfig[key]> extends boolean
						? BooleanConstructor
						: never;
			required: IsOptional<DatabuddyConfig[key]> extends true ? false : true;
		};
	},
	setup(props: DatabuddyConfig) {
		const scriptRef = ref<HTMLScriptElement | null>(null);

		const injectScript = () => {
			const clientId = detectClientId(props.clientId);
			if (!clientId || props.disabled || isScriptInjected()) {
				return;
			}

			const script = createScript({ ...props, clientId });

			document.head.appendChild(script);
			scriptRef.value = script;
		};

		const removeScript = () => {
			if (scriptRef.value) {
				scriptRef.value.remove();
				scriptRef.value = null;
			}
		};

		onMounted(() => {
			injectScript();
		});

		onUnmounted(() => {
			removeScript();
		});

		watch(
			() => props,
			() => {
				removeScript();
				injectScript();
			},
			{ deep: true }
		);

		return () => null;
	},
});
