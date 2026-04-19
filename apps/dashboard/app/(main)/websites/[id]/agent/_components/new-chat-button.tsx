"use client";

import { IconPlusFillDuo18 } from "nucleo-ui-fill-duo-18";
import { generateId } from "ai";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewChatButton() {
	const router = useRouter();
	const { id } = useParams();

	const handleNewChat = () => {
		const newChatId = generateId();
		router.push(`/websites/${id}/agent/${newChatId}`);
	};

	return (
		<Button
			aria-label="New chat"
			onClick={handleNewChat}
			size="sm"
			variant="ghost"
		>
			<IconPlusFillDuo18 className="size-4" />
		</Button>
	);
}
