import { BaseFlagsManager } from "@/core/flags/flags-manager";
import type { FlagsManagerOptions } from "@/core/flags/types";

export class ServerFlagsManager extends BaseFlagsManager {
	private readonly initPromise: Promise<void>;

	constructor(options: FlagsManagerOptions) {
		super(options);
		this.config.autoFetch = options.config.autoFetch ?? false;
		this.config.skipStorage = true;
		this.initPromise = this.runInit();
	}

	protected override batchDelay(): number {
		return 5;
	}

	async waitForInit(): Promise<void> {
		await this.initPromise;
	}
}
