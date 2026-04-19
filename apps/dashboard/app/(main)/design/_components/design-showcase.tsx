"use client";

import { Avatar } from "@/components/ds/avatar";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Checkbox } from "@/components/ds/checkbox";
import { Dialog } from "@/components/ds/dialog";
import { Divider } from "@/components/ds/divider";
import { DropdownMenu } from "@/components/ds/dropdown-menu";
import { EmptyState } from "@/components/ds/empty-state";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Popover } from "@/components/ds/popover";
import { Select } from "@/components/ds/select";
import { Sheet } from "@/components/ds/sheet";
import { Skeleton } from "@/components/ds/skeleton";
import { Spinner } from "@/components/ds/spinner";
import { Switch } from "@/components/ds/switch";
import { Tabs } from "@/components/ds/tabs";
import { Text } from "@/components/ds/text";
import { Textarea } from "@/components/ds/textarea";
import { Tooltip } from "@/components/ds/tooltip";
import {
	Bell,
	Gear,
	Globe,
	Key,
	Lock,
	MagnifyingGlass,
	Moon,
	Palette,
	Plus,
	ShieldCheck,
	Sun,
	Trash,
	TrendUp,
	User,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { ShowcaseRow, ShowcaseSection } from "./showcase-section";

const BUTTON_VARIANTS = ["primary", "secondary", "ghost"] as const;
const BUTTON_TONES = ["neutral", "danger"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;

const BADGE_VARIANTS = [
	"default",
	"primary",
	"success",
	"warning",
	"destructive",
	"muted",
] as const;

const TEXT_VARIANTS = [
	"display",
	"title",
	"heading",
	"body",
	"label",
	"caption",
] as const;

export function DesignShowcase() {
	const [sheetOpen, setSheetOpen] = useState(false);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-0 overflow-auto px-4 py-8 md:px-6 md:py-10">
			<header className="flex flex-col gap-1 pb-12">
				<Text variant="display">Design system</Text>
				<Text className="max-w-2xl text-pretty" tone="muted" variant="body">
					Every primitive in{" "}
					<Text
						as="code"
						className="rounded bg-secondary px-1.5 py-0.5"
						mono
						variant="caption"
					>
						components/ds/
					</Text>{" "}
					— built on Base UI, styled with Tailwind, iconography from Phosphor.
				</Text>
			</header>

			<ShowcaseSection
				description="Polymorphic component — renders the semantic element for each variant automatically. Supports tone, mono, and custom `as` overrides."
				id="text"
				title="Text"
			>
				<ShowcaseRow label="Scale">
					<div className="flex w-full flex-col gap-3">
						{TEXT_VARIANTS.map((v) => (
							<div className="flex items-baseline gap-4" key={v}>
								<Text
									className="w-14 shrink-0 text-right"
									mono
									tone="muted"
									variant="caption"
								>
									{v}
								</Text>
								<Text variant={v}>The quick brown fox jumps</Text>
							</div>
						))}
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Tones">
					<Text>Default</Text>
					<Divider className="h-4" orientation="vertical" />
					<Text tone="muted">Muted</Text>
					<Divider className="h-4" orientation="vertical" />
					<Text tone="destructive">Destructive</Text>
				</ShowcaseRow>
				<ShowcaseRow label="Mono">
					<Text mono>0xDEADBEEF</Text>
					<Text mono tone="muted" variant="caption">
						sha-a5a6f35
					</Text>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Three variants (primary, secondary, ghost) × two tones (neutral, danger) × three sizes."
				id="button"
				title="Button"
			>
				{BUTTON_TONES.map((tone) => (
					<ShowcaseRow key={tone} label={tone}>
						<div className="flex flex-col gap-3">
							{BUTTON_VARIANTS.map((variant) => (
								<div className="flex items-center gap-2" key={variant}>
									<Text
										className="w-20 shrink-0 text-right"
										mono
										tone="muted"
										variant="caption"
									>
										{variant}
									</Text>
									{BUTTON_SIZES.map((size) => (
										<Button
											key={size}
											size={size}
											tone={tone}
											variant={variant}
										>
											{size}
										</Button>
									))}
									<Button disabled size="md" tone={tone} variant={variant}>
										disabled
									</Button>
								</div>
							))}
						</div>
					</ShowcaseRow>
				))}
				<ShowcaseRow label="With icons">
					<Button>
						<Plus className="size-3.5" />
						Create
					</Button>
					<Button tone="danger">
						<Trash className="size-3.5" />
						Delete
					</Button>
					<Button variant="secondary">
						<Gear className="size-3.5" />
						Settings
					</Button>
					<Button variant="ghost">
						<User className="size-3.5" />
						Profile
					</Button>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Six semantic variants at two sizes. Pill-shaped, inline."
				id="badge"
				title="Badge"
			>
				<ShowcaseRow label="md">
					{BADGE_VARIANTS.map((v) => (
						<Badge key={v} variant={v}>
							{v}
						</Badge>
					))}
				</ShowcaseRow>
				<ShowcaseRow label="sm">
					{BADGE_VARIANTS.map((v) => (
						<Badge key={v} size="sm" variant={v}>
							{v}
						</Badge>
					))}
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Composed surface — Card.Header (muted bg), Card.Content, Card.Footer (angled-rectangle-gradient). All slots optional."
				id="card"
				title="Card"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<Card>
						<Card.Header>
							<Card.Title>Full card</Card.Title>
							<Card.Description>Header, content, and footer.</Card.Description>
						</Card.Header>
						<Card.Content>
							<Text tone="muted">Content area — forms, lists, anything.</Text>
						</Card.Content>
						<Card.Footer>
							<Button size="sm" variant="secondary">
								Cancel
							</Button>
							<Button size="sm">Save</Button>
						</Card.Footer>
					</Card>
					<Card>
						<Card.Header>
							<Card.Title>Header only</Card.Title>
							<Card.Description>
								No content or footer slots used.
							</Card.Description>
						</Card.Header>
					</Card>
					<Card>
						<Card.Content className="flex items-center gap-3">
							<Avatar alt="Iza" size="md" />
							<div className="flex min-w-0 flex-1 flex-col">
								<Text variant="label">Iza</Text>
								<Text tone="muted" variant="caption">
									iza@databuddy.cc
								</Text>
							</div>
							<Badge size="sm" variant="primary">
								Owner
							</Badge>
						</Card.Content>
					</Card>
					<Card>
						<Card.Content className="flex flex-col items-center gap-2 py-8">
							<Spinner size="md" />
							<Text tone="muted" variant="caption">
								Loading…
							</Text>
						</Card.Content>
					</Card>
				</div>
			</ShowcaseSection>

			<ShowcaseSection
				description="Field wires label, description, error, and aria attributes to its child input via context. No manual id plumbing needed."
				id="field"
				title="Field & Input"
			>
				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<Field.Label>Default</Field.Label>
						<Input placeholder="Placeholder text" />
						<Field.Description>Helper text below the input.</Field.Description>
					</Field>
					<Field>
						<Field.Label>With prefix</Field.Label>
						<Input
							placeholder="Search…"
							prefix={<MagnifyingGlass className="size-3.5" />}
						/>
					</Field>
					<Field>
						<Field.Label>With suffix</Field.Label>
						<Input
							defaultValue="sk_live_..."
							suffix={<Key className="size-3.5" />}
						/>
					</Field>
					<Field error>
						<Field.Label>Error state</Field.Label>
						<Input defaultValue="bad-value" />
						<Field.Error>Domain is already taken.</Field.Error>
					</Field>
					<Field>
						<Field.Label>Disabled</Field.Label>
						<Input defaultValue="read-only" disabled />
					</Field>
					<Field>
						<Field.Label>Prefix + suffix</Field.Label>
						<Input placeholder="amount" prefix="$" suffix="USD" />
					</Field>
				</div>
			</ShowcaseSection>

			<ShowcaseSection
				description="Plain textarea wired to Field context. Supports all standard textarea attributes."
				id="textarea"
				title="Textarea"
			>
				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<Field.Label>Default</Field.Label>
						<Textarea placeholder="Write something…" />
					</Field>
					<Field error>
						<Field.Label>With error</Field.Label>
						<Textarea defaultValue="Too short" />
						<Field.Error>Minimum 20 characters.</Field.Error>
					</Field>
				</div>
			</ShowcaseSection>

			<ShowcaseSection
				description="Single-select dropdown with built-in label registry — Select.Value automatically displays the selected item's text label."
				id="select"
				title="Select"
			>
				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<Field.Label>Plan</Field.Label>
						<Select defaultValue="pro">
							<Select.Trigger />
							<Select.Content>
								<Select.Item value="free">Free</Select.Item>
								<Select.Item value="pro">Pro</Select.Item>
								<Select.Item value="enterprise">Enterprise</Select.Item>
							</Select.Content>
						</Select>
					</Field>
					<Field>
						<Field.Label>With groups</Field.Label>
						<Select defaultValue="7d">
							<Select.Trigger />
							<Select.Content>
								<Select.Group>
									<Select.GroupLabel>Quick</Select.GroupLabel>
									<Select.Item value="24h">Last 24 hours</Select.Item>
									<Select.Item value="7d">Last 7 days</Select.Item>
									<Select.Item value="30d">Last 30 days</Select.Item>
								</Select.Group>
								<Select.Group>
									<Select.GroupLabel>Calendar</Select.GroupLabel>
									<Select.Item value="mtd">Month to date</Select.Item>
									<Select.Item value="ytd">Year to date</Select.Item>
								</Select.Group>
							</Select.Content>
						</Select>
					</Field>
				</div>
			</ShowcaseSection>

			<ShowcaseSection
				description="Both support standalone use or composed with label + description. Wired to Field context when nested."
				id="controls"
				title="Switch & Checkbox"
			>
				<ShowcaseRow label="Switch">
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-6">
							<Switch />
							<Switch defaultChecked />
							<Switch disabled />
							<Switch defaultChecked disabled />
						</div>
						<Divider />
						<Switch
							defaultChecked
							description="Receive alerts when anomalies are detected."
							label="Email notifications"
						/>
						<Switch
							description="A summary of your analytics every Monday."
							label="Weekly digest"
						/>
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Checkbox">
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-6">
							<Checkbox />
							<Checkbox defaultChecked />
							<Checkbox disabled />
							<Checkbox defaultChecked disabled />
						</div>
						<Divider />
						<Checkbox
							defaultChecked
							description="You must accept before continuing."
							label="I agree to the terms"
						/>
						<Checkbox label="Subscribe to changelog" />
					</div>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Pill-style tabs with animated indicator. Tabs.Tab, Tabs.Panel, Tabs.List."
				id="tabs"
				title="Tabs"
			>
				<Tabs defaultValue="overview">
					<Tabs.List>
						<Tabs.Tab value="overview">Overview</Tabs.Tab>
						<Tabs.Tab value="analytics">Analytics</Tabs.Tab>
						<Tabs.Tab value="settings">Settings</Tabs.Tab>
						<Tabs.Tab disabled value="disabled">
							Disabled
						</Tabs.Tab>
					</Tabs.List>
					<Tabs.Panel className="pt-4" value="overview">
						<Card>
							<Card.Content>
								<Text tone="muted">
									Overview panel — tab content can be anything.
								</Text>
							</Card.Content>
						</Card>
					</Tabs.Panel>
					<Tabs.Panel className="pt-4" value="analytics">
						<Card>
							<Card.Content>
								<Text tone="muted">Analytics panel.</Text>
							</Card.Content>
						</Card>
					</Tabs.Panel>
					<Tabs.Panel className="pt-4" value="settings">
						<Card>
							<Card.Content>
								<Text tone="muted">Settings panel.</Text>
							</Card.Content>
						</Card>
					</Tabs.Panel>
				</Tabs>
			</ShowcaseSection>

			<ShowcaseSection
				description="Three sizes. Falls back to initials derived from `alt` or an explicit `fallback` string."
				id="avatar"
				title="Avatar"
			>
				<ShowcaseRow label="Sizes">
					<Avatar alt="Small" size="sm" />
					<Avatar alt="Medium" size="md" />
					<Avatar alt="Large User" size="lg" />
				</ShowcaseRow>
				<ShowcaseRow label="Fallbacks">
					<Avatar fallback="DB" size="md" />
					<Avatar fallback="?" size="md" />
					<Avatar alt="Jane Doe" size="md" />
					<Avatar
						alt="Broken"
						size="md"
						src="https://bad-url.invalid/nope.png"
					/>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Hover or focus the trigger to reveal. Clones the child ref — works on any focusable element."
				id="tooltip"
				title="Tooltip"
			>
				<ShowcaseRow>
					<Tooltip content="I appear on top" side="top">
						<Button variant="secondary">Top</Button>
					</Tooltip>
					<Tooltip content="I appear below" side="bottom">
						<Button variant="secondary">Bottom</Button>
					</Tooltip>
					<Tooltip content="I appear to the left" side="left">
						<Button variant="secondary">Left</Button>
					</Tooltip>
					<Tooltip content="I appear to the right" side="right">
						<Button variant="secondary">Right</Button>
					</Tooltip>
					<Tooltip content="Works on any element">
						<Badge variant="success">Hover me</Badge>
					</Tooltip>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Modal with Header (muted bg), Body, Footer (angled-rectangle-gradient). Close button auto-positioned top-right, or wrap any child with Dialog.Close."
				id="dialog"
				title="Dialog"
			>
				<ShowcaseRow>
					<Dialog>
						<Dialog.Trigger>
							<Button variant="secondary">Default dialog</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Close />
							<Dialog.Header>
								<Dialog.Title>Edit website</Dialog.Title>
								<Dialog.Description>
									Change the name and domain for this property.
								</Dialog.Description>
							</Dialog.Header>
							<Dialog.Body className="flex flex-col gap-4">
								<Field>
									<Field.Label>Name</Field.Label>
									<Input defaultValue="My Website" />
								</Field>
								<Field>
									<Field.Label>Domain</Field.Label>
									<Input defaultValue="example.com" />
								</Field>
							</Dialog.Body>
							<Dialog.Footer>
								<Dialog.Close>
									<Button variant="secondary">Cancel</Button>
								</Dialog.Close>
								<Button>Save</Button>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog>
					<Dialog>
						<Dialog.Trigger>
							<Button tone="danger" variant="secondary">
								Destructive dialog
							</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Close />
							<Dialog.Header>
								<Dialog.Title>Delete website</Dialog.Title>
								<Dialog.Description>
									This will permanently remove all analytics data. This action
									cannot be undone.
								</Dialog.Description>
							</Dialog.Header>
							<Dialog.Footer>
								<Dialog.Close>
									<Button variant="secondary">Cancel</Button>
								</Dialog.Close>
								<Button tone="danger">Delete forever</Button>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Slide-out panel — same sub-component API as Dialog. Supports `side` prop for left or right."
				id="sheet"
				title="Sheet"
			>
				<ShowcaseRow>
					<Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
						<Sheet.Trigger>
							<Button variant="secondary">Open sheet</Button>
						</Sheet.Trigger>
						<Sheet.Content>
							<Sheet.Close />
							<Sheet.Header>
								<Sheet.Title>Website details</Sheet.Title>
								<Sheet.Description>
									View and edit this property.
								</Sheet.Description>
							</Sheet.Header>
							<Sheet.Body className="flex flex-col gap-4">
								<Field>
									<Field.Label>Name</Field.Label>
									<Input defaultValue="databuddy.cc" />
								</Field>
								<Field>
									<Field.Label>Notes</Field.Label>
									<Textarea placeholder="Internal notes…" />
								</Field>
							</Sheet.Body>
							<Sheet.Footer>
								<Button onClick={() => setSheetOpen(false)} variant="secondary">
									Cancel
								</Button>
								<Button>Save</Button>
							</Sheet.Footer>
						</Sheet.Content>
					</Sheet>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Floating menu with items, groups, separators, and a destructive variant."
				id="dropdown"
				title="Dropdown menu"
			>
				<ShowcaseRow>
					<DropdownMenu>
						<DropdownMenu.Trigger>
							<Button variant="secondary">Actions</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start">
							<DropdownMenu.GroupLabel>Navigate</DropdownMenu.GroupLabel>
							<DropdownMenu.Item>
								<Gear className="size-3.5" />
								Settings
							</DropdownMenu.Item>
							<DropdownMenu.Item>
								<User className="size-3.5" />
								Profile
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item variant="destructive">
								<Trash className="size-3.5" />
								Delete
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenu.Trigger>
							<Button size="sm" variant="ghost">
								<Gear className="size-3.5" />
								Icon trigger
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<DropdownMenu.Item>Option A</DropdownMenu.Item>
							<DropdownMenu.Item>Option B</DropdownMenu.Item>
							<DropdownMenu.Item>Option C</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Anchored floating panel with title and description."
				id="popover"
				title="Popover"
			>
				<ShowcaseRow>
					<Popover>
						<Popover.Trigger>
							<Button variant="secondary">Open popover</Button>
						</Popover.Trigger>
						<Popover.Content>
							<Popover.Title>Invite teammate</Popover.Title>
							<Popover.Description className="mt-1">
								Enter their email to send an invite.
							</Popover.Description>
							<div className="mt-3 flex flex-col gap-2">
								<Input placeholder="name@company.com" />
								<Button size="sm">Send invite</Button>
							</div>
						</Popover.Content>
					</Popover>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Horizontal or vertical rule. Defaults to horizontal."
				id="divider"
				title="Divider"
			>
				<ShowcaseRow label="Horizontal">
					<div className="w-full space-y-2">
						<Text tone="muted" variant="caption">
							Section A
						</Text>
						<Divider />
						<Text tone="muted" variant="caption">
							Section B
						</Text>
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Vertical">
					<div className="flex h-8 items-center gap-3">
						<Text tone="muted" variant="caption">
							Left
						</Text>
						<Divider orientation="vertical" />
						<Text tone="muted" variant="caption">
							Right
						</Text>
					</div>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Animated pulse placeholder for loading states. Shape it with className."
				id="skeleton"
				title="Skeleton"
			>
				<ShowcaseRow label="Card skeleton">
					<div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border/60 p-5">
						<div className="flex items-center gap-3">
							<Skeleton className="size-10 rounded-full" />
							<div className="flex flex-1 flex-col gap-2">
								<Skeleton className="h-3.5 w-28" />
								<Skeleton className="h-3 w-40" />
							</div>
						</div>
						<Skeleton className="h-20 w-full" />
						<div className="flex gap-2">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
						</div>
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Table skeleton">
					<div className="flex w-full max-w-sm flex-col gap-3">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-3/4" />
					</div>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Loading spinner with spin animation. Three sizes."
				id="spinner"
				title="Spinner"
			>
				<ShowcaseRow label="Sizes">
					<div className="flex items-center gap-6">
						<div className="flex flex-col items-center gap-2">
							<Spinner size="sm" />
							<Text mono tone="muted" variant="caption">
								sm
							</Text>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Spinner size="md" />
							<Text mono tone="muted" variant="caption">
								md
							</Text>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Spinner size="lg" />
							<Text mono tone="muted" variant="caption">
								lg
							</Text>
						</div>
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="In context">
					<Button disabled>
						<Spinner size="sm" />
						Saving…
					</Button>
				</ShowcaseRow>
			</ShowcaseSection>

			<ShowcaseSection
				description="Centered placeholder with optional icon, title, description, and action slot."
				id="empty-state"
				title="Empty state"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-lg border border-border/60 border-dashed py-16">
						<EmptyState
							action={
								<Button size="sm">
									<Plus className="size-3.5" />
									Add website
								</Button>
							}
							description="Get started by adding your first website to track."
							icon={<TrendUp />}
							title="No websites yet"
						/>
					</div>
					<div className="rounded-lg border border-border/60 border-dashed py-16">
						<EmptyState
							description="Try adjusting your filters or date range."
							title="No data"
						/>
					</div>
				</div>
			</ShowcaseSection>

			<ShowcaseSection
				description="A composed settings page demonstrating how primitives combine into a real product surface."
				id="settings-mockup"
				title="Mockup — Settings"
			>
				<SettingsMockup />
			</ShowcaseSection>
		</div>
	);
}

function SettingsMockup() {
	const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

	return (
		<Card>
			<Card.Header>
				<div className="flex items-center gap-2">
					<Gear className="size-4 text-muted-foreground" />
					<Card.Title>Settings</Card.Title>
				</div>
				<Card.Description>
					Manage your account and preferences.
				</Card.Description>
			</Card.Header>
			<Card.Content className="p-0">
				<Tabs defaultValue="general">
					<div className="border-border/60 border-b px-6">
						<Tabs.List>
							<Tabs.Tab value="general">
								<User className="size-3" />
								General
							</Tabs.Tab>
							<Tabs.Tab value="notifications">
								<Bell className="size-3" />
								Notifications
							</Tabs.Tab>
							<Tabs.Tab value="appearance">
								<Palette className="size-3" />
								Appearance
							</Tabs.Tab>
							<Tabs.Tab value="security">
								<ShieldCheck className="size-3" />
								Security
							</Tabs.Tab>
						</Tabs.List>
					</div>

					<Tabs.Panel className="p-6" value="general">
						<div className="flex flex-col gap-6">
							<div className="flex items-center gap-4">
								<Avatar alt="Iza Nassiri" size="lg" />
								<div className="flex flex-col gap-1">
									<Text variant="label">Iza Nassiri</Text>
									<Text tone="muted" variant="caption">
										iza@databuddy.cc
									</Text>
								</div>
								<Button className="ml-auto" size="sm" variant="secondary">
									Change avatar
								</Button>
							</div>
							<Divider />
							<div className="grid gap-6 sm:grid-cols-2">
								<Field>
									<Field.Label>Full name</Field.Label>
									<Input defaultValue="Iza Nassiri" />
								</Field>
								<Field>
									<Field.Label>Email</Field.Label>
									<Input
										defaultValue="iza@databuddy.cc"
										prefix={<Globe className="size-3.5" />}
									/>
								</Field>
								<Field>
									<Field.Label>Role</Field.Label>
									<Select defaultValue="owner">
										<Select.Trigger />
										<Select.Content>
											<Select.Item value="owner">Owner</Select.Item>
											<Select.Item value="admin">Admin</Select.Item>
											<Select.Item value="member">Member</Select.Item>
											<Select.Item value="viewer">Viewer</Select.Item>
										</Select.Content>
									</Select>
								</Field>
								<Field>
									<Field.Label>Timezone</Field.Label>
									<Select defaultValue="utc3">
										<Select.Trigger />
										<Select.Content>
											<Select.Item value="utc-8">UTC-8 (Pacific)</Select.Item>
											<Select.Item value="utc-5">UTC-5 (Eastern)</Select.Item>
											<Select.Item value="utc0">UTC+0 (London)</Select.Item>
											<Select.Item value="utc1">UTC+1 (Paris)</Select.Item>
											<Select.Item value="utc3">UTC+3 (Istanbul)</Select.Item>
											<Select.Item value="utc8">UTC+8 (Singapore)</Select.Item>
										</Select.Content>
									</Select>
								</Field>
							</div>
							<Field>
								<Field.Label>Bio</Field.Label>
								<Textarea defaultValue="Building Databuddy — privacy-first analytics for the modern web." />
								<Field.Description>
									Brief description for your profile.
								</Field.Description>
							</Field>
						</div>
					</Tabs.Panel>

					<Tabs.Panel className="p-6" value="notifications">
						<div className="flex flex-col gap-6">
							<div className="flex flex-col gap-1">
								<Text variant="label">Email notifications</Text>
								<Text tone="muted" variant="caption">
									Choose which updates you want to receive.
								</Text>
							</div>
							<div className="flex flex-col gap-4">
								<Switch
									defaultChecked
									description="Get notified when traffic spikes or drops unexpectedly."
									label="Anomaly alerts"
								/>
								<Switch
									defaultChecked
									description="A summary of your analytics every Monday at 9am."
									label="Weekly digest"
								/>
								<Switch
									description="Detailed performance report at the end of each month."
									label="Monthly report"
								/>
								<Switch
									defaultChecked
									description="Immediate alert when a monitored endpoint goes down."
									label="Uptime incidents"
								/>
							</div>
							<Divider />
							<div className="flex flex-col gap-1">
								<Text variant="label">In-app notifications</Text>
								<Text tone="muted" variant="caption">
									Control what appears in your notification center.
								</Text>
							</div>
							<div className="flex flex-col gap-4">
								<Switch
									defaultChecked
									description="When someone invites you to an organization."
									label="Team invitations"
								/>
								<Switch
									defaultChecked
									description="When a tracked goal reaches its target."
									label="Goal completions"
								/>
								<Switch
									description="New features and product updates."
									label="Feature announcements"
								/>
							</div>
							<Divider />
							<Field>
								<Field.Label>Notification email</Field.Label>
								<Input
									defaultValue="iza@databuddy.cc"
									prefix={<Bell className="size-3.5" />}
								/>
								<Field.Description>
									Override the default email for notifications.
								</Field.Description>
							</Field>
						</div>
					</Tabs.Panel>

					<Tabs.Panel className="p-6" value="appearance">
						<div className="flex flex-col gap-6">
							<div className="flex flex-col gap-1">
								<Text variant="label">Theme</Text>
								<Text tone="muted" variant="caption">
									Select your preferred color scheme.
								</Text>
							</div>
							<div className="grid grid-cols-3 gap-3">
								{(["light", "dark", "system"] as const).map((t) => (
									<button
										className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${theme === t ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
										key={t}
										onClick={() => setTheme(t)}
										type="button"
									>
										{t === "light" && <Sun className="size-5" />}
										{t === "dark" && <Moon className="size-5" />}
										{t === "system" && <Gear className="size-5" />}
										<Text variant="caption">
											{t.charAt(0).toUpperCase() + t.slice(1)}
										</Text>
									</button>
								))}
							</div>
							<Divider />
							<div className="flex flex-col gap-4">
								<Switch
									defaultChecked
									description="Minimize animations throughout the interface."
									label="Reduced motion"
								/>
								<Switch
									description="Decrease spacing and font sizes for denser layouts."
									label="Compact mode"
								/>
							</div>
							<Divider />
							<div className="grid gap-6 sm:grid-cols-2">
								<Field>
									<Field.Label>Date format</Field.Label>
									<Select defaultValue="relative">
										<Select.Trigger />
										<Select.Content>
											<Select.Item value="relative">
												Relative (2 hours ago)
											</Select.Item>
											<Select.Item value="absolute">
												Absolute (Apr 19, 2026)
											</Select.Item>
											<Select.Item value="iso">
												ISO 8601 (2026-04-19)
											</Select.Item>
										</Select.Content>
									</Select>
								</Field>
								<Field>
									<Field.Label>Number format</Field.Label>
									<Select defaultValue="short">
										<Select.Trigger />
										<Select.Content>
											<Select.Item value="short">Short (12.5K)</Select.Item>
											<Select.Item value="full">Full (12,500)</Select.Item>
										</Select.Content>
									</Select>
								</Field>
							</div>
						</div>
					</Tabs.Panel>

					<Tabs.Panel className="p-6" value="security">
						<div className="flex flex-col gap-6">
							<div className="flex flex-col gap-1">
								<Text variant="label">Password</Text>
								<Text tone="muted" variant="caption">
									Update your password to keep your account secure.
								</Text>
							</div>
							<div className="grid gap-6 sm:grid-cols-2">
								<Field>
									<Field.Label>Current password</Field.Label>
									<Input
										placeholder="••••••••"
										suffix={<Lock className="size-3.5" />}
										type="password"
									/>
								</Field>
								<div />
								<Field>
									<Field.Label>New password</Field.Label>
									<Input
										placeholder="••••••••"
										suffix={<Key className="size-3.5" />}
										type="password"
									/>
								</Field>
								<Field>
									<Field.Label>Confirm password</Field.Label>
									<Input
										placeholder="••••••••"
										suffix={<Key className="size-3.5" />}
										type="password"
									/>
								</Field>
							</div>
							<Divider />
							<div className="flex flex-col gap-1">
								<Text variant="label">Two-factor authentication</Text>
								<Text tone="muted" variant="caption">
									Add an extra layer of security to your account.
								</Text>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
										<ShieldCheck className="size-5 text-muted-foreground" />
									</div>
									<div className="flex flex-col gap-0.5">
										<Text variant="label">Authenticator app</Text>
										<Text tone="muted" variant="caption">
											Use an app like 1Password or Authy.
										</Text>
									</div>
								</div>
								<Button size="sm" variant="secondary">
									Enable
								</Button>
							</div>
							<Divider />
							<div className="flex flex-col gap-1">
								<Text variant="label">Active sessions</Text>
								<Text tone="muted" variant="caption">
									Devices currently signed in to your account.
								</Text>
							</div>
							<div className="flex flex-col gap-3">
								{[
									{
										device: "MacBook Pro — Chrome",
										location: "Istanbul, TR",
										current: true,
									},
									{
										device: "iPhone 15 — Safari",
										location: "Istanbul, TR",
										current: false,
									},
									{
										device: "Windows PC — Firefox",
										location: "London, UK",
										current: false,
									},
								].map((s) => (
									<div
										className="flex items-center justify-between rounded-lg border border-border/60 p-3"
										key={s.device}
									>
										<div className="flex items-center gap-3">
											<div className="flex size-8 items-center justify-center rounded-md bg-secondary">
												<Globe className="size-3.5 text-muted-foreground" />
											</div>
											<div className="flex flex-col gap-0.5">
												<div className="flex items-center gap-2">
													<Text variant="caption">{s.device}</Text>
													{s.current && (
														<Badge size="sm" variant="success">
															Current
														</Badge>
													)}
												</div>
												<Text tone="muted" variant="caption">
													{s.location}
												</Text>
											</div>
										</div>
										{!s.current && (
											<Button size="sm" tone="danger" variant="ghost">
												Revoke
											</Button>
										)}
									</div>
								))}
							</div>
						</div>
					</Tabs.Panel>
				</Tabs>
			</Card.Content>
			<Card.Footer>
				<Button variant="secondary">Cancel</Button>
				<Button>Save changes</Button>
			</Card.Footer>
		</Card>
	);
}
