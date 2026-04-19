"use client";

import { ChatTextIcon } from "@phosphor-icons/react/dist/ssr";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";
import { Text } from "@/components/ds/text";
import dayjs from "@/lib/dayjs";
import { orpc } from "@/lib/orpc";
import { FeedbackStatusBadge } from "./feedback-status-badge";
import { SubmitFeedbackDialog } from "./submit-feedback-dialog";

const CATEGORY_LABELS: Record<string, string> = {
	bug_report: "Bug Report",
	feature_request: "Feature Request",
	ux_improvement: "UX Improvement",
	performance: "Performance",
	documentation: "Documentation",
	other: "Other",
};

function FeedbackRowSkeleton() {
	return (
		<div className="flex items-center gap-4 px-5 py-3">
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-3.5 w-48" />
				<Skeleton className="h-3 w-64" />
				<Skeleton className="h-3 w-24" />
			</div>
			<Skeleton className="h-5 w-16 rounded-full" />
		</div>
	);
}

export function FeedbackTable() {
	const { data: items, isLoading } = useQuery(
		orpc.feedback.list.queryOptions({ input: {} })
	);

	return (
		<Card>
			<Card.Header className="flex-row items-start justify-between gap-4">
				<div>
					<Card.Title>My Feedback</Card.Title>
					<Card.Description>
						Submit feedback and earn credits when it gets approved
					</Card.Description>
				</div>
				<SubmitFeedbackDialog />
			</Card.Header>
			<Card.Content className="p-0">
				{isLoading ? (
					<div className="divide-y">
						<FeedbackRowSkeleton />
						<FeedbackRowSkeleton />
						<FeedbackRowSkeleton />
					</div>
				) : !items || items.length === 0 ? (
					<div className="py-8">
						<EmptyState
							icon={<ChatTextIcon weight="duotone" />}
							title="No feedback yet"
						/>
					</div>
				) : (
					<div className="divide-y">
						{items.map((item) => (
							<div className="px-5 py-3" key={item.id}>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1 space-y-0.5">
										<div className="flex items-center gap-2">
											<Text className="truncate" variant="label">
												{item.title}
											</Text>
											<FeedbackStatusBadge status={item.status} />
										</div>
										<Text
											className="line-clamp-2 leading-relaxed"
											tone="muted"
											variant="caption"
										>
											{item.description}
										</Text>
										<Text className="opacity-70" tone="muted" variant="caption">
											{CATEGORY_LABELS[item.category] ?? item.category}
											{" · "}
											{dayjs(item.createdAt).fromNow()}
										</Text>
									</div>
									{item.status === "approved" && item.creditsAwarded > 0 && (
										<Text
											className="shrink-0 text-success tabular-nums"
											variant="label"
										>
											+{item.creditsAwarded}
										</Text>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</Card.Content>
		</Card>
	);
}
