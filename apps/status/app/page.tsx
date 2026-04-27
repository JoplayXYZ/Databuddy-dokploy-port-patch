import { permanentRedirect } from "next/navigation";
import { DATABUDDY_UPTIME_URL } from "@/lib/status-url";

export default function RootPage() {
	permanentRedirect(DATABUDDY_UPTIME_URL);
}
