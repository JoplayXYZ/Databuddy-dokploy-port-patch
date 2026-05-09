// Session types for consistent data structures across the app

export type SessionEventSource =
	| "analytics"
	| "custom"
	| "error"
	| "outgoing_link";

export interface SessionEvent {
	event_id: string;
	event_name: string;
	path: string;
	properties: Record<string, unknown>;
	source?: SessionEventSource;
	time: string;
}

export interface SessionWebVital {
	metric_name: string;
	metric_value: number;
	path: string;
	time: string;
}

export interface ProfileDetail {
	browser: string | null;
	country: string | null;
	device: string | null;
	first_visit: string;
	last_visit: string;
	os: string | null;
	region: string | null;
	total_duration: number;
	total_duration_formatted: string;
	total_pageviews: number;
	total_sessions: number;
	visitor_id: string;
}

export interface ProfileSession {
	browser: string | null;
	country: string | null;
	device: string | null;
	duration: number;
	duration_formatted: string;
	events: RawSessionEventTuple[];
	first_visit: string;
	last_visit: string;
	os: string | null;
	page_views: number;
	referrer: string | null;
	region: string | null;
	session_id: string;
	session_name: string;
	unique_pages: number;
	web_vitals: RawSessionWebVitalTuple[];
}

export interface SessionReferrer {
	domain: string | null;
	name: string;
}

export interface Session {
	browser_name: string;
	country: string;
	country_code: string;
	country_name: string;
	device_type: string;
	events: RawSessionEventTuple[] | SessionEvent[];
	first_visit: string;
	is_returning_visitor?: boolean;
	last_visit: string;
	os_name: string;
	page_views: number;
	referrer: string;
	referrer_parsed?: {
		name?: string;
		domain?: string;
	};
	session_id: string;
	session_name?: string;
	visitor_id: string;
	visitor_session_count?: number;
	web_vitals?: RawSessionWebVitalTuple[] | SessionWebVital[];
}

export interface SessionRowProps {
	index: number;
	isExpanded: boolean;
	onToggle: (sessionId: string) => void;
	session: Session;
}

// Raw ClickHouse tuple format for events (before transformation)
export type RawSessionEventTuple = [
	string, // event_id
	string, // time
	string, // event_name
	string, // path
	string | null, // properties (JSON string)
	SessionEventSource?, // source table/category
];

// Raw ClickHouse tuple format for web vitals (kept separate from events)
export type RawSessionWebVitalTuple = [
	string, // metric_name
	number, // metric_value
	string, // time
	string, // path
];
