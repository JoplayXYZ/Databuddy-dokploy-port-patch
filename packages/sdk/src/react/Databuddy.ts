import { useEffect } from "react";
import { createScript, isScriptInjected } from "@/core/script";
import type { DatabuddyConfig } from "@/core/types";
import { detectClientId } from "@/utils";

export function Databuddy(props: DatabuddyConfig) {
	const clientId = detectClientId(props.clientId);

	useEffect(() => {
		if (!clientId) {
			if (!props.disabled && props.debug) {
				console.warn(
					"Databuddy: No client ID found. Please provide clientId prop or set NEXT_PUBLIC_DATABUDDY_CLIENT_ID environment variable."
				);
			}
			return;
		}

		if (props.disabled || isScriptInjected()) {
			return;
		}

		const script = createScript({ ...props, clientId });
		document.head.appendChild(script);

		return () => {
			script.remove();
		};
	}, [clientId, props.disabled]);

	return null;
}
