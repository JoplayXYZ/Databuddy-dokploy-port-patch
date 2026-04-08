import { RightSidebar } from "@/components/right-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shell that matches the `h-full lg:grid lg:grid-cols-[1fr_18rem]` layout
 * used by every settings page. Content is slotted on the left; the right
 * sidebar is the shared `RightSidebar.Skeleton`.
 */
function SettingsShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full lg:grid lg:grid-cols-[1fr_18rem]">
			<div className="flex flex-col border-b lg:border-b-0">{children}</div>
			<RightSidebar.Skeleton />
		</div>
	);
}

// ───── Members list (avatar rows) ─────

function MemberRowSkeleton() {
	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-4">
			<Skeleton className="size-10 rounded-full" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-3 w-56" />
			</div>
			<Skeleton className="h-8 w-24 rounded" />
			<Skeleton className="size-7 rounded" />
		</div>
	);
}

export function MembersSkeleton() {
	return (
		<SettingsShell>
			<div className="flex-1 divide-y overflow-y-auto">
				<MemberRowSkeleton />
				<MemberRowSkeleton />
				<MemberRowSkeleton />
				<MemberRowSkeleton />
			</div>
		</SettingsShell>
	);
}

// ───── Invitations list (avatar rows, 3 cols) ─────

function InvitationRowSkeleton() {
	return (
		<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4">
			<Skeleton className="size-10 rounded-full" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-48" />
				<Skeleton className="h-3 w-40" />
			</div>
			<Skeleton className="h-8 w-20 rounded" />
		</div>
	);
}

export function InvitationsSkeleton() {
	return (
		<SettingsShell>
			<div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
				<Skeleton className="h-9 w-24 rounded" />
				<Skeleton className="h-9 w-24 rounded" />
				<Skeleton className="h-9 w-24 rounded" />
			</div>
			<div className="flex-1 divide-y overflow-y-auto">
				<InvitationRowSkeleton />
				<InvitationRowSkeleton />
				<InvitationRowSkeleton />
			</div>
		</SettingsShell>
	);
}

// ───── Members page (outer Tabs wrapper) ─────

export function MembersPageSkeleton() {
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-10 shrink-0 items-center gap-5 border-b bg-accent/30 px-3">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="min-h-0 flex-1">
				<MembersSkeleton />
			</div>
		</div>
	);
}

// ───── API Keys list (icon rows) ─────

function ApiKeyRowSkeleton() {
	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-4">
			<Skeleton className="size-10 rounded border" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-40" />
				<div className="flex items-center gap-3">
					<Skeleton className="h-4 w-20 rounded" />
					<Skeleton className="h-3 w-28" />
				</div>
			</div>
			<Skeleton className="h-6 w-16 rounded" />
			<Skeleton className="size-4" />
		</div>
	);
}

export function ApiKeysSkeleton() {
	return (
		<SettingsShell>
			<div className="flex-1 divide-y overflow-y-auto">
				<ApiKeyRowSkeleton />
				<ApiKeyRowSkeleton />
				<ApiKeyRowSkeleton />
			</div>
		</SettingsShell>
	);
}

// ───── General settings (avatar + details + websites list) ─────

export function GeneralSettingsSkeleton() {
	return (
		<SettingsShell>
			<div className="flex-1 overflow-y-auto">
				{/* Avatar section */}
				<section className="space-y-4 border-b px-5 py-6">
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-44" />
						<Skeleton className="h-3 w-60" />
					</div>
					<div className="flex items-center gap-4">
						<Skeleton className="size-16 rounded-full" />
						<Skeleton className="h-9 w-28 rounded" />
					</div>
				</section>

				{/* Organization Details section */}
				<section className="space-y-4 border-b px-5 py-6">
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-3 w-80" />
					</div>
					{/* Org ID row */}
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-3.5 w-32" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-8 w-20 rounded" />
					</div>
					{/* Name + slug inputs */}
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-3 w-48" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-3 w-56" />
						</div>
					</div>
				</section>

				{/* Websites list section */}
				<section className="border-b px-5 py-6">
					<div className="mb-4 flex items-start justify-between gap-4">
						<div className="space-y-1.5">
							<Skeleton className="h-4 w-56" />
							<Skeleton className="h-3 w-72" />
						</div>
						<Skeleton className="h-8 w-28 rounded" />
					</div>
					<div className="divide-y rounded border">
						{["a", "b", "c"].map((k) => (
							<div
								className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
								key={`site-${k}`}
							>
								<Skeleton className="size-8 rounded" />
								<div className="space-y-1.5">
									<Skeleton className="h-3.5 w-32" />
									<Skeleton className="h-3 w-48" />
								</div>
								<Skeleton className="size-4" />
							</div>
						))}
					</div>
				</section>
			</div>
		</SettingsShell>
	);
}

// ───── Danger zone (transfer + destruct sections) ─────

export function DangerZoneSkeleton() {
	return (
		<SettingsShell>
			<div className="flex flex-col gap-6 p-5">
				{/* Transfer Assets section */}
				<section className="space-y-4">
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-80" />
					</div>
					<Skeleton className="h-14 w-full rounded" />
					<Skeleton className="h-40 w-full rounded" />
				</section>

				{/* Destructive action section */}
				<section className="mt-auto rounded border border-destructive/20 bg-destructive/5 p-4">
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1.5">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-64" />
						</div>
						<Skeleton className="h-8 w-20 rounded" />
					</div>
				</section>
			</div>
		</SettingsShell>
	);
}

// ───── Organizations list (top-level /organizations page) ─────

function OrgListRowSkeleton() {
	return (
		<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4">
			<Skeleton className="size-10 rounded-full" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-3 w-24" />
			</div>
			<Skeleton className="h-6 w-14 rounded" />
		</div>
	);
}

export function OrganizationsListSkeleton() {
	return (
		<SettingsShell>
			<div className="flex-1 divide-y overflow-y-auto">
				<OrgListRowSkeleton />
				<OrgListRowSkeleton />
				<OrgListRowSkeleton />
			</div>
		</SettingsShell>
	);
}
