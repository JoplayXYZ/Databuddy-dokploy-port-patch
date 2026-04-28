import { CustomEventsBuilders } from "./custom-events";
import { DevicesBuilders } from "./devices";
import { EngagementBuilders } from "./engagement";
import { ErrorsBuilders } from "./errors";
import { GeoBuilders } from "./geo";
import { LinkShortenerBuilders, LinksBuilders } from "./links";
import { LLMAnalyticsBuilders } from "./llm-analytics";
import { PagesBuilders } from "./pages";
import { PerformanceBuilders } from "./performance";
import { ProfilesBuilders } from "./profiles";
import { RealtimeBuilders } from "./realtime";
import { RevenueBuilders } from "./revenue";
import { SessionsBuilders } from "./sessions";
import { SummaryBuilders } from "./summary";
import { TrafficBuilders } from "./traffic";
import { UptimeBuilders } from "./uptime";
import { VitalsBuilders } from "./vitals";

export const QueryBuilders = {
	...SummaryBuilders,
	...PagesBuilders,
	...TrafficBuilders,
	...DevicesBuilders,
	...GeoBuilders,
	...ErrorsBuilders,
	...PerformanceBuilders,
	...SessionsBuilders,
	...CustomEventsBuilders,
	...ProfilesBuilders,
	...LinksBuilders,
	...LinkShortenerBuilders,
	...EngagementBuilders,
	...VitalsBuilders,
	...UptimeBuilders,
	...LLMAnalyticsBuilders,
	...RevenueBuilders,
	...RealtimeBuilders,
};

export type QueryType = keyof typeof QueryBuilders;
