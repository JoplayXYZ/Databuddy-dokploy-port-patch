"use client";

import { fromNow } from "@databuddy/ui";

interface LastCheckedProps {
	timestamp: string;
}

export function LastChecked({ timestamp }: LastCheckedProps) {
	return <p className="text-muted-foreground text-xs">{fromNow(timestamp)}</p>;
}
