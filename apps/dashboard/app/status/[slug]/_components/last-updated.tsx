"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useInterval } from "@databuddy/ui";
import { guessTimezone } from "@databuddy/ui";
import { formatDateTime, localDayjs } from "@databuddy/ui";
import { ClockIcon } from "@databuddy/ui/icons";

const REFRESH_INTERVAL_SEC = 60;

interface LastUpdatedProps {
	timestamp: string | null;
}

export function LastUpdated({ timestamp }: LastUpdatedProps) {
	const tz = guessTimezone();
	const abbreviation = localDayjs().format("z");
	const router = useRouter();
	const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
	const countdownRef = useRef(REFRESH_INTERVAL_SEC);

	const tick = useCallback(() => {
		countdownRef.current -= 1;

		if (countdownRef.current <= 0) {
			countdownRef.current = REFRESH_INTERVAL_SEC;
			setCountdown(REFRESH_INTERVAL_SEC);
			router.refresh();
			return;
		}

		setCountdown(countdownRef.current);
	}, [router]);

	useInterval(tick, 1000);

	if (!timestamp) {
		return null;
	}

	return (
		<div className="flex items-center justify-between text-muted-foreground text-xs">
			<div className="flex items-center gap-1.5">
				<ClockIcon className="size-3.5 shrink-0" weight="duotone" />
				<span>
					Last checked {formatDateTime(timestamp)}{" "}
					<span className="text-muted-foreground/60">{abbreviation || tz}</span>
				</span>
			</div>
			<span className="text-muted-foreground/60 tabular-nums">
				{countdown}s
			</span>
		</div>
	);
}
