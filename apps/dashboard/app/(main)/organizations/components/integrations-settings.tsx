"use client";

import type { SlackIntegrationOutput, WebsiteOutput } from "@databuddy/rpc";
import {
	DiscordLogoIcon,
	FigmaLogoIcon,
	GithubLogoIcon,
	NotionLogoIcon,
	SlackLogoIcon,
	StripeLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/top-bar";
import type { Organization } from "@/hooks/use-organizations";
import { orpc } from "@/lib/orpc";
import {
	CaretDownIcon,
	CheckCircleIcon,
	ClockIcon,
	GlobeIcon,
	MsgContentIcon,
	PlugIcon,
	TriangleWarningIcon,
} from "@databuddy/ui/icons";
import {
	Badge,
	Button,
	Card,
	Skeleton,
	Text,
	buttonVariants,
	cn,
	dayjs,
} from "@databuddy/ui";
import { DropdownMenu } from "@databuddy/ui/client";

type SlackIntegration = SlackIntegrationOutput;
type Website = WebsiteOutput;
type BrandIcon = React.ComponentType<{ className?: string }>;

interface IntegrationCatalogItem {
	accent: string;
	category: string;
	description: string;
	icon: BrandIcon;
	id: string;
	name: string;
}

const SIMPLE_ICONS = {
	cloudflare:
		"M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727",
	googleAnalytics:
		"M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z",
	linear:
		"M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
	posthog:
		"M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z",
	sentry:
		"M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z",
	vercel: "m12 1.608 12 20.784H0Z",
};

const SLACK_ITEM: IntegrationCatalogItem = {
	accent: "#611f69",
	category: "AI agent",
	description: "Ask Databuddy analytics questions from Slack channels and DMs.",
	icon: SlackLogoIcon,
	id: "slack",
	name: "Slack",
};

const COMING_SOON_INTEGRATIONS: IntegrationCatalogItem[] = [
	{
		accent: "#181717",
		category: "Deployments",
		description:
			"Annotate releases, PRs, and incidents against traffic changes.",
		icon: GithubLogoIcon,
		id: "github",
		name: "GitHub",
	},
	{
		accent: "#5E6AD2",
		category: "Product ops",
		description: "Link conversion shifts and anomalies to issues and roadmaps.",
		icon: LinearLogoIcon,
		id: "linear",
		name: "Linear",
	},
	{
		accent: "#635BFF",
		category: "Revenue",
		description: "Join payment events, subscriptions, and revenue analytics.",
		icon: StripeLogoIcon,
		id: "stripe",
		name: "Stripe",
	},
	{
		accent: "#5865F2",
		category: "Alerts",
		description:
			"Route monitor, anomaly, and agent notifications into Discord.",
		icon: DiscordLogoIcon,
		id: "discord",
		name: "Discord",
	},
	{
		accent: "#E37400",
		category: "Import",
		description: "Import historical traffic when teams migrate into Databuddy.",
		icon: GoogleAnalyticsLogoIcon,
		id: "google-analytics",
		name: "Google Analytics",
	},
	{
		accent: "#000000",
		category: "Deployments",
		description:
			"Correlate Vercel deploys and previews with analytics outcomes.",
		icon: VercelLogoIcon,
		id: "vercel",
		name: "Vercel",
	},
	{
		accent: "#F38020",
		category: "Edge",
		description:
			"Connect edge traffic, cache signals, and site performance context.",
		icon: CloudflareLogoIcon,
		id: "cloudflare",
		name: "Cloudflare",
	},
	{
		accent: "#362D59",
		category: "Errors",
		description: "Join frontend/backend exceptions with affected sessions.",
		icon: SentryLogoIcon,
		id: "sentry",
		name: "Sentry",
	},
	{
		accent: "#000000",
		category: "Migration",
		description: "Bring events and cohorts across from PostHog workspaces.",
		icon: PostHogLogoIcon,
		id: "posthog",
		name: "PostHog",
	},
	{
		accent: "#000000",
		category: "Docs",
		description: "Publish recurring analytics summaries to team docs.",
		icon: NotionLogoIcon,
		id: "notion",
		name: "Notion",
	},
	{
		accent: "#F24E1E",
		category: "Design",
		description: "Attach launch notes and experiment context from design work.",
		icon: FigmaLogoIcon,
		id: "figma",
		name: "Figma",
	},
];

function websiteLabel(website: Pick<Website, "domain" | "name">): string {
	return website.name?.trim() || website.domain;
}

function selectedWebsiteLabel(
	integration: SlackIntegration,
	websites: Website[]
): string {
	const fromList = websites.find(
		(site) => site.id === integration.defaultWebsiteId
	);
	if (fromList) {
		return websiteLabel(fromList);
	}
	if (integration.defaultWebsiteName || integration.defaultWebsiteDomain) {
		return (
			integration.defaultWebsiteName ??
			integration.defaultWebsiteDomain ??
			"Unknown website"
		);
	}
	return "No default website";
}

function slackStatusBadge(
	integrations: SlackIntegration[],
	isLoading: boolean
) {
	if (isLoading) {
		return (
			<Badge size="sm" variant="muted">
				Checking
			</Badge>
		);
	}
	if (integrations.some((item) => item.status === "active")) {
		return (
			<Badge size="sm" variant="success">
				Connected
			</Badge>
		);
	}
	return (
		<Badge size="sm" variant="warning">
			Setup needed
		</Badge>
	);
}

function slackAction(integrations: SlackIntegration[], isLoading: boolean) {
	if (isLoading) {
		return (
			<Button disabled size="sm" variant="secondary">
				<ClockIcon className="size-4" />
				Checking
			</Button>
		);
	}
	if (integrations.length > 0) {
		return (
			<Button disabled size="sm" variant="secondary">
				<CheckCircleIcon className="size-4" />
				Connected
			</Button>
		);
	}
	return (
		<Button
			disabled
			size="sm"
			title="Slack OAuth install is the next backend slice"
			variant="secondary"
		>
			<PlugIcon className="size-4" />
			Connect
		</Button>
	);
}

function slackWorkspaceBadge(integration: SlackIntegration) {
	if (integration.status === "active" && integration.defaultWebsiteId) {
		return (
			<Badge size="sm" variant="success">
				Active
			</Badge>
		);
	}
	if (
		integration.status === "active" &&
		integration.channelBindings.length > 0
	) {
		return (
			<Badge size="sm" variant="warning">
				Partial
			</Badge>
		);
	}
	if (integration.status === "active") {
		return (
			<Badge size="sm" variant="warning">
				Needs website
			</Badge>
		);
	}
	return (
		<Badge size="sm" variant="muted">
			Disabled
		</Badge>
	);
}

export function IntegrationsSettingsSkeleton() {
	return (
		<div className="mx-auto max-w-4xl p-5">
			<Card>
				<Card.Header>
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-72" />
				</Card.Header>
				<Card.Content className="p-0">
					{Array.from({ length: 8 }, (_, index) => (
						<div
							className="flex items-center gap-3 border-border/60 border-b px-5 py-4 last:border-b-0"
							key={index}
						>
							<Skeleton className="size-10 rounded" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-3.5 w-40" />
								<Skeleton className="h-3 w-72" />
							</div>
							<Skeleton className="h-6 w-20 rounded-full" />
						</div>
					))}
				</Card.Content>
			</Card>
		</div>
	);
}

export function IntegrationsSettings({
	organization,
}: {
	organization: Organization;
}) {
	const queryClient = useQueryClient();
	const listKey = orpc.integrations.list.key({
		input: { organizationId: organization.id },
	});

	const integrationsQuery = useQuery({
		...orpc.integrations.list.queryOptions({
			input: { organizationId: organization.id },
		}),
	});

	const websitesQuery = useQuery({
		...orpc.websites.list.queryOptions({
			input: { organizationId: organization.id },
		}),
	});

	const updateDefaultWebsite = useMutation({
		...orpc.integrations.updateSlackDefaultWebsite.mutationOptions(),
		onError: () => {
			toast.error("Could not update Slack website");
		},
		onSuccess: async () => {
			toast.success("Slack default website updated");
			await queryClient.invalidateQueries({ queryKey: listKey });
		},
	});

	const slackIntegrations = (integrationsQuery.data?.slack ??
		[]) as SlackIntegration[];
	const websites = (websitesQuery.data ?? []) as Website[];

	return (
		<div className="flex h-full flex-col">
			<TopBar.Breadcrumbs
				items={[
					{ label: "Settings", href: "/organizations/settings" },
					{ label: "Integrations" },
				]}
			/>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-4xl p-5">
					<Card>
						<Card.Header>
							<Card.Title>Integrations</Card.Title>
							<Card.Description>
								Connect Databuddy to the tools your organization already uses
							</Card.Description>
						</Card.Header>

						<Card.Content className="p-0">
							<IntegrationListRow
								action={slackAction(
									slackIntegrations,
									integrationsQuery.isLoading
								)}
								badge={slackStatusBadge(
									slackIntegrations,
									integrationsQuery.isLoading
								)}
								item={SLACK_ITEM}
							>
								<SlackIntegrationDetails
									integrations={slackIntegrations}
									isLoading={integrationsQuery.isLoading}
									onDefaultWebsiteChange={(integrationId, defaultWebsiteId) =>
										updateDefaultWebsite.mutate({
											defaultWebsiteId,
											integrationId,
											organizationId: organization.id,
										})
									}
									updatingIntegrationId={
										updateDefaultWebsite.isPending
											? updateDefaultWebsite.variables?.integrationId
											: undefined
									}
									websites={websites}
									websitesLoading={websitesQuery.isLoading}
								/>
							</IntegrationListRow>

							{COMING_SOON_INTEGRATIONS.map((item) => (
								<IntegrationListRow
									action={
										<Button disabled size="sm" variant="secondary">
											<ClockIcon className="size-4" />
											Soon
										</Button>
									}
									badge={
										<Badge size="sm" variant="muted">
											Coming soon
										</Badge>
									}
									item={item}
									key={item.id}
								/>
							))}
						</Card.Content>
					</Card>
				</div>
			</div>
		</div>
	);
}

function IntegrationListRow({
	action,
	badge,
	children,
	item,
}: {
	action: React.ReactNode;
	badge: React.ReactNode;
	children?: React.ReactNode;
	item: IntegrationCatalogItem;
}) {
	const Icon = item.icon;

	return (
		<div className="border-border/60 border-b last:border-b-0">
			<div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<span
						className="flex size-10 shrink-0 items-center justify-center rounded border border-border/60 bg-background"
						style={{ color: item.accent }}
					>
						<Icon className="size-5" />
					</span>
					<div className="min-w-0">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<h3 className="truncate font-semibold text-foreground text-sm">
								{item.name}
							</h3>
							{badge}
							<Badge size="sm" variant="muted">
								{item.category}
							</Badge>
						</div>
						<Text className="mt-1" tone="muted" variant="caption">
							{item.description}
						</Text>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2 sm:justify-end">
					{action}
				</div>
			</div>
			{children}
		</div>
	);
}

function SlackIntegrationDetails({
	integrations,
	isLoading,
	onDefaultWebsiteChange,
	updatingIntegrationId,
	websites,
	websitesLoading,
}: {
	integrations: SlackIntegration[];
	isLoading: boolean;
	onDefaultWebsiteChange: (
		integrationId: string,
		defaultWebsiteId: string | null
	) => void;
	updatingIntegrationId?: string;
	websites: Website[];
	websitesLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div className="px-5 pb-4">
				<div className="rounded border border-border/60 bg-secondary/30">
					<SlackWorkspaceSkeleton />
					<SlackWorkspaceSkeleton />
				</div>
			</div>
		);
	}

	if (integrations.length === 0) {
		return (
			<div className="px-5 pb-4">
				<div className="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-muted-foreground text-xs">
					<TriangleWarningIcon className="size-3.5 shrink-0 text-warning" />
					No Slack workspace is connected to this organization yet.
				</div>
			</div>
		);
	}

	return (
		<div className="px-5 pb-4">
			<div className="rounded border border-border/60 bg-secondary/30">
				{integrations.map((integration) => (
					<SlackWorkspaceRow
						integration={integration}
						isUpdating={updatingIntegrationId === integration.id}
						key={integration.id}
						onDefaultWebsiteChange={(defaultWebsiteId) =>
							onDefaultWebsiteChange(integration.id, defaultWebsiteId)
						}
						websites={websites}
						websitesLoading={websitesLoading}
					/>
				))}
			</div>
		</div>
	);
}

function SlackWorkspaceSkeleton() {
	return (
		<div className="flex items-center gap-3 border-border/60 border-b px-3 py-3 last:border-b-0">
			<Skeleton className="size-8 rounded" />
			<div className="min-w-0 flex-1 space-y-2">
				<Skeleton className="h-3.5 w-32" />
				<Skeleton className="h-3 w-24" />
			</div>
			<Skeleton className="h-8 w-44 rounded-md" />
		</div>
	);
}

function SlackWorkspaceRow({
	integration,
	isUpdating,
	onDefaultWebsiteChange,
	websites,
	websitesLoading,
}: {
	integration: SlackIntegration;
	isUpdating: boolean;
	onDefaultWebsiteChange: (websiteId: string | null) => void;
	websites: Website[];
	websitesLoading: boolean;
}) {
	const label = selectedWebsiteLabel(integration, websites);
	const teamName = integration.teamName ?? integration.teamId;
	const canChooseWebsite =
		websites.length > 0 && integration.status === "active" && !websitesLoading;

	return (
		<div className="border-border/60 border-b px-3 py-3 last:border-b-0">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<span className="truncate font-semibold text-foreground text-xs">
							{teamName}
						</span>
						{slackWorkspaceBadge(integration)}
					</div>
					<Text className="font-mono" tone="muted" variant="caption">
						{integration.teamId}
					</Text>
				</div>

				<DropdownMenu>
					<DropdownMenu.Trigger
						className={buttonVariants({
							className: "max-w-full justify-between sm:w-56",
							size: "sm",
							variant: "secondary",
						})}
						disabled={!canChooseWebsite || isUpdating}
					>
						<span className="truncate">{label}</span>
						<CaretDownIcon className="size-3 shrink-0" weight="fill" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" className="w-64">
						<DropdownMenu.GroupLabel>Default website</DropdownMenu.GroupLabel>
						<DropdownMenu.Item onClick={() => onDefaultWebsiteChange(null)}>
							No default website
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						{websites.map((website) => (
							<DropdownMenu.Item
								key={website.id}
								onClick={() => onDefaultWebsiteChange(website.id)}
							>
								<GlobeIcon className="size-3.5 text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate">
									{websiteLabel(website)}
								</span>
								{website.id === integration.defaultWebsiteId && (
									<CheckCircleIcon className="size-3.5 text-success" />
								)}
							</DropdownMenu.Item>
						))}
					</DropdownMenu.Content>
				</DropdownMenu>
			</div>

			<div className="mt-3 grid gap-2 sm:grid-cols-3">
				<IntegrationMeta
					label="Default"
					tone={integration.defaultWebsiteId ? "normal" : "warning"}
					value={label}
				/>
				<IntegrationMeta
					label="Channels"
					value={`${integration.channelBindings.length} bound`}
				/>
				<IntegrationMeta
					label="Updated"
					value={dayjs(integration.updatedAt).fromNow()}
				/>
			</div>

			{integration.channelBindings.length > 0 && (
				<div className="mt-3 rounded border border-border/60 bg-background">
					{integration.channelBindings.map((binding) => (
						<div
							className="flex items-center gap-3 border-border/60 border-b px-3 py-2 last:border-b-0"
							key={binding.id}
						>
							<MsgContentIcon className="size-3.5 shrink-0 text-muted-foreground" />
							<span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
								{binding.slackChannelId}
							</span>
							<span className="truncate text-foreground text-xs">
								{binding.websiteName ??
									binding.websiteDomain ??
									binding.websiteId}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function IntegrationMeta({
	label,
	tone = "normal",
	value,
}: {
	label: string;
	tone?: "normal" | "warning";
	value: string;
}) {
	return (
		<div
			className={cn(
				"rounded border border-border/60 bg-background px-3 py-2",
				tone === "warning" && "border-warning/30 bg-warning/10"
			)}
		>
			<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
				{tone === "warning" && (
					<TriangleWarningIcon className="size-3 text-warning" />
				)}
				{label}
			</div>
			<p className="mt-1 truncate font-medium text-foreground text-xs">
				{value}
			</p>
		</div>
	);
}

function SimpleBrandIcon({
	className,
	path,
}: {
	className?: string;
	path: string;
}) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path d={path} />
		</svg>
	);
}

function LinearLogoIcon({ className }: { className?: string }) {
	return <SimpleBrandIcon className={className} path={SIMPLE_ICONS.linear} />;
}

function GoogleAnalyticsLogoIcon({ className }: { className?: string }) {
	return (
		<SimpleBrandIcon
			className={className}
			path={SIMPLE_ICONS.googleAnalytics}
		/>
	);
}

function VercelLogoIcon({ className }: { className?: string }) {
	return <SimpleBrandIcon className={className} path={SIMPLE_ICONS.vercel} />;
}

function CloudflareLogoIcon({ className }: { className?: string }) {
	return (
		<SimpleBrandIcon className={className} path={SIMPLE_ICONS.cloudflare} />
	);
}

function SentryLogoIcon({ className }: { className?: string }) {
	return <SimpleBrandIcon className={className} path={SIMPLE_ICONS.sentry} />;
}

function PostHogLogoIcon({ className }: { className?: string }) {
	return <SimpleBrandIcon className={className} path={SIMPLE_ICONS.posthog} />;
}
