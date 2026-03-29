export interface FlagResult {
	enabled: boolean;
	value: boolean | string | number;
	payload: Record<string, unknown> | null;
	reason: string;
	variant?: string;
}

export interface UserContext {
	userId?: string;
	email?: string;
	organizationId?: string;
	teamId?: string;
	properties?: Record<string, unknown>;
}

export interface FlagsConfig {
	clientId: string;
	apiUrl?: string;
	user?: UserContext;
	disabled?: boolean;
	debug?: boolean;
	/** Skip persistent storage (browser only) */
	skipStorage?: boolean;
	/** Defer evaluation until session resolves */
	isPending?: boolean;
	/** Auto-fetch all flags on init (default: true) */
	autoFetch?: boolean;
	environment?: string;
	/** Cache TTL in ms (default: 60000) */
	cacheTtl?: number;
	/** Stale time in ms — revalidate in background after this (default: cacheTtl/2) */
	staleTime?: number;
	/** Default values by flag key */
	defaults?: Record<string, boolean | string | number>;
}

export type FlagStatus = "loading" | "ready" | "error" | "pending";

export interface FlagState {
	on: boolean;
	status: FlagStatus;
	loading: boolean;
	value?: boolean | string | number;
	variant?: string;
}

export interface FlagsContext {
	getFlag: (key: string) => FlagState;
	getValue: <T extends boolean | string | number = boolean>(
		key: string,
		defaultValue?: T
	) => T;
	isOn: (key: string) => boolean;
	fetchFlag: (key: string) => Promise<FlagResult>;
	fetchAllFlags: () => Promise<void>;
	updateUser: (user: UserContext) => void;
	refresh: (forceClear?: boolean) => Promise<void>;
	isReady: boolean;
}

export interface FlagsSnapshot {
	flags: Record<string, FlagResult>;
	isReady: boolean;
}

export interface StorageInterface {
	getAll(): Record<string, FlagResult>;
	setAll(flags: Record<string, FlagResult>): void;
	clear(): void;
}

export interface FlagsManagerOptions {
	config: FlagsConfig;
	storage?: StorageInterface;
}

export interface FlagsManager {
	getFlag(key: string, user?: UserContext): Promise<FlagResult>;
	isEnabled(key: string): FlagState;
	getValue<T = boolean | string | number>(key: string, defaultValue?: T): T;
	fetchAllFlags(user?: UserContext): Promise<void>;
	updateUser(user: UserContext): void;
	refresh(forceClear?: boolean): Promise<void>;
	updateConfig(config: FlagsConfig): void;
	getMemoryFlags(): Record<string, FlagResult>;
	isReady(): boolean;
	destroy(): void;
	subscribe(callback: () => void): () => void;
	getSnapshot(): FlagsSnapshot;
}
