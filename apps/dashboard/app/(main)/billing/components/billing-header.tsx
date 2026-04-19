"use client";

import { IconCreditCardFillDuo18 } from "nucleo-ui-fill-duo-18";
import { usePathname } from "next/navigation";
import { PageHeader } from "../../websites/_components/page-header";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
	"/billing": {
		title: "Billing Overview",
		description: "Current plan, usage, and payment method for this workspace",
	},
	"/billing/plans": {
		title: "Plans",
		description: "Compare plans and change your subscription",
	},
	"/billing/history": {
		title: "Invoices",
		description: "Past invoices and payment history",
	},
};

const DEFAULT_TITLE = {
	title: "Billing",
	description: "Manage this workspace's subscription, usage, and invoices",
};

export function BillingHeader() {
	const pathname = usePathname();
	const { title, description } = PAGE_TITLES[pathname] ?? DEFAULT_TITLE;

	return (
		<PageHeader
			description={description}
			icon={<IconCreditCardFillDuo18 />}
			title={title}
		/>
	);
}
