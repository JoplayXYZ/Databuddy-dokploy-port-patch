class Logger {
	private debugEnabled = false;

	setDebug(enabled: boolean): void {
		this.debugEnabled = enabled;
	}

	debug(...args: unknown[]): void {
		if (this.debugEnabled) {
			console.log("[Databuddy]", ...args);
		}
	}

	info(...args: unknown[]): void {
		console.info("[Databuddy]", ...args);
	}

	warn(...args: unknown[]): void {
		console.warn("[Databuddy]", ...args);
	}

	error(...args: unknown[]): void {
		console.error("[Databuddy]", ...args);
	}

	table(data: unknown): void {
		if (this.debugEnabled) {
			console.table(data);
		}
	}

	time(label: string): void {
		if (this.debugEnabled) {
			console.time(`[Databuddy] ${label}`);
		}
	}

	timeEnd(label: string): void {
		if (this.debugEnabled) {
			console.timeEnd(`[Databuddy] ${label}`);
		}
	}

	json(data: unknown): void {
		if (this.debugEnabled) {
			console.log("[Databuddy]", JSON.stringify(data, null, 2));
		}
	}
}

export const logger = new Logger();
