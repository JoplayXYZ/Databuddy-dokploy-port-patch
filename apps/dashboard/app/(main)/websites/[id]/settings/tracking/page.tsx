"use client";

import { useParams } from "next/navigation";
import { WebsiteTrackingSetupTab } from "../../_components/tabs/tracking-setup-tab";

export default function TrackingSetupPage() {
	const params = useParams();
	const websiteId = params.id as string;

	return (
		<div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
			<WebsiteTrackingSetupTab websiteId={websiteId} />
		</div>
	);
}
