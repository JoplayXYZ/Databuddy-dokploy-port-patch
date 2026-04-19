"use client";

import { IconUsersFillDuo18 } from "nucleo-ui-fill-duo-18";
import { EmptyState } from "@/components/empty-state";
import type { GroupsListProps } from "../../_components/types";
import { GroupItem } from "./group-item";

export function GroupsList({
	groups,
	isLoading,
	onCreateGroupAction,
	onEditGroupAction,
	onDeleteGroup,
}: GroupsListProps) {
	if (isLoading) {
		return null;
	}

	if (groups.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-16">
				<EmptyState
					action={{
						label: "Create a group",
						onClick: onCreateGroupAction,
					}}
					description="Reusable sets of users you can target from any flag."
					icon={<IconUsersFillDuo18 />}
					title="No target groups yet"
					variant="minimal"
				/>
			</div>
		);
	}

	return (
		<div>
			{groups.map((group) => (
				<GroupItem
					group={group}
					key={group.id}
					onDelete={onDeleteGroup ?? (() => {})}
					onEdit={onEditGroupAction}
				/>
			))}
		</div>
	);
}
