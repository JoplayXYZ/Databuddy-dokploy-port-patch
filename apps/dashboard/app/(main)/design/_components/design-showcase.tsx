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
	IconChartBarTrendUpFillDuo18,
	IconGearFillDuo18,
	IconKeyFillDuo18,
	IconMagnifierFillDuo18,
	IconPlusFillDuo18,
	IconTrashFillDuo18,
	IconUserFillDuo18,
} from "nucleo-ui-fill-duo-18";
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
					<Text as="code" className="rounded bg-secondary px-1.5 py-0.5" mono variant="caption">
						components/ds/
					</Text>
					{" "}— built on Base UI, styled with Tailwind, iconography from Nucleo
					fill-duo.
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
								<Text className="w-14 shrink-0 text-right" mono tone="muted" variant="caption">
									{v}
								</Text>
								<Text variant={v}>The quick brown fox jumps</Text>
							</div>
						))}
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Tones">
					<Text>Default</Text>
					<Divider orientation="vertical" className="h-4" />
					<Text tone="muted">Muted</Text>
					<Divider orientation="vertical" className="h-4" />
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
									<Text className="w-20 shrink-0 text-right" mono tone="muted" variant="caption">
										{variant}
									</Text>
									{BUTTON_SIZES.map((size) => (
										<Button key={size} size={size} tone={tone} variant={variant}>
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
						<IconPlusFillDuo18 className="size-3.5" />
						Create
					</Button>
					<Button tone="danger">
						<IconTrashFillDuo18 className="size-3.5" />
						Delete
					</Button>
					<Button variant="secondary">
						<IconGearFillDuo18 className="size-3.5" />
						Settings
					</Button>
					<Button variant="ghost">
						<IconUserFillDuo18 className="size-3.5" />
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
						<Badge key={v} variant={v}>{v}</Badge>
					))}
				</ShowcaseRow>
				<ShowcaseRow label="sm">
					{BADGE_VARIANTS.map((v) => (
						<Badge key={v} size="sm" variant={v}>{v}</Badge>
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
							<Button variant="secondary" size="sm">Cancel</Button>
							<Button size="sm">Save</Button>
						</Card.Footer>
					</Card>
					<Card>
						<Card.Header>
							<Card.Title>Header only</Card.Title>
							<Card.Description>No content or footer slots used.</Card.Description>
						</Card.Header>
					</Card>
					<Card>
						<Card.Content className="flex items-center gap-3">
							<Avatar alt="Iza" size="md" />
							<div className="flex min-w-0 flex-1 flex-col">
								<Text variant="label">Iza</Text>
								<Text tone="muted" variant="caption">iza@databuddy.cc</Text>
							</div>
							<Badge variant="primary" size="sm">Owner</Badge>
						</Card.Content>
					</Card>
					<Card>
						<Card.Content className="flex flex-col items-center gap-2 py-8">
							<Spinner size="md" />
							<Text tone="muted" variant="caption">Loading…</Text>
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
							prefix={<IconMagnifierFillDuo18 className="size-3.5" />}
						/>
					</Field>
					<Field>
						<Field.Label>With suffix</Field.Label>
						<Input
							defaultValue="sk_live_..."
							suffix={<IconKeyFillDuo18 className="size-3.5" />}
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
						<Input
							placeholder="amount"
							prefix="$"
							suffix="USD"
						/>
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
						<Switch defaultChecked label="Email notifications" description="Receive alerts when anomalies are detected." />
						<Switch label="Weekly digest" description="A summary of your analytics every Monday." />
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
						<Checkbox defaultChecked label="I agree to the terms" description="You must accept before continuing." />
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
						<Tabs.Tab disabled value="disabled">Disabled</Tabs.Tab>
					</Tabs.List>
					<Tabs.Panel className="pt-4" value="overview">
						<Card>
							<Card.Content>
								<Text tone="muted">Overview panel — tab content can be anything.</Text>
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
					<Avatar src="https://bad-url.invalid/nope.png" alt="Broken" size="md" />
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
								<Dialog.Description>Change the name and domain for this property.</Dialog.Description>
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
							<Button tone="danger" variant="secondary">Destructive dialog</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Close />
							<Dialog.Header>
								<Dialog.Title>Delete website</Dialog.Title>
								<Dialog.Description>This will permanently remove all analytics data. This action cannot be undone.</Dialog.Description>
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
								<Sheet.Description>View and edit this property.</Sheet.Description>
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
								<Button onClick={() => setSheetOpen(false)} variant="secondary">Cancel</Button>
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
								<IconGearFillDuo18 className="size-3.5" />
								Settings
							</DropdownMenu.Item>
							<DropdownMenu.Item>
								<IconUserFillDuo18 className="size-3.5" />
								Profile
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item variant="destructive">
								<IconTrashFillDuo18 className="size-3.5" />
								Delete
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenu.Trigger>
							<Button variant="ghost" size="sm">
								<IconGearFillDuo18 className="size-3.5" />
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
						<Text tone="muted" variant="caption">Section A</Text>
						<Divider />
						<Text tone="muted" variant="caption">Section B</Text>
					</div>
				</ShowcaseRow>
				<ShowcaseRow label="Vertical">
					<div className="flex h-8 items-center gap-3">
						<Text tone="muted" variant="caption">Left</Text>
						<Divider orientation="vertical" />
						<Text tone="muted" variant="caption">Right</Text>
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
				description="Nucleo AI loading icon with spin animation. Three sizes."
				id="spinner"
				title="Spinner"
			>
				<ShowcaseRow label="Sizes">
					<div className="flex items-center gap-6">
						<div className="flex flex-col items-center gap-2">
							<Spinner size="sm" />
							<Text mono tone="muted" variant="caption">sm</Text>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Spinner size="md" />
							<Text mono tone="muted" variant="caption">md</Text>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Spinner size="lg" />
							<Text mono tone="muted" variant="caption">lg</Text>
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
									<IconPlusFillDuo18 className="size-3.5" />
									Add website
								</Button>
							}
							description="Get started by adding your first website to track."
							icon={<IconChartBarTrendUpFillDuo18 />}
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
		</div>
	);
}
