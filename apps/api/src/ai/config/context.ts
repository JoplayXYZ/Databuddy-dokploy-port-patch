export interface AppContext {
	billingCustomerId?: string | null;
	chatId: string;
	currentDateTime: string;
	organizationId?: string | null;
	requestHeaders?: Headers;
	timezone: string;
	userId: string;
	websiteDomain: string;
	websiteId: string;
	[key: string]: unknown;
}

export function formatContextForLLM(context: AppContext): string {
	return `<website_info>
<current_date>${context.currentDateTime}</current_date>
<timezone>${context.timezone}</timezone>
<website_id>${context.websiteId}</website_id>
<website_domain>${context.websiteDomain}</website_domain>
</website_info>`;
}
