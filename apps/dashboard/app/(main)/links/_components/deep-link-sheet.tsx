"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	type DeepLinkApp,
	DEEP_LINK_APPS,
} from "@databuddy/shared/constants/deep-link-apps";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { Button } from "@/components/ds/button";
import { Field } from "@/components/ds/field";
import { Input } from "@/components/ds/input";
import { Sheet } from "@/components/ds/sheet";
import { useCreateLink } from "@/hooks/use-links";
import { DeepLinkAppIcon } from "./deep-link-icons";
import { LINKS_BASE_URL } from "./link-constants";
import {
	mapLinkApiError,
	normalizeUrlInput,
	stripProtocol,
} from "./link-utils";

const deepLinkFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	targetUrl: z.string().min(1, "URL is required"),
	slug: z.string().optional(),
});

type DeepLinkFormData = z.infer<typeof deepLinkFormSchema>;

function ensureProtocol(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) {
		return trimmed;
	}
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

function validateUrlForApp(url: string, app: DeepLinkApp): string | null {
	try {
		const parsed = new URL(ensureProtocol(url));
		if (!app.hostnames.includes(parsed.hostname)) {
			return `URL must be a ${app.name} link`;
		}
		return null;
	} catch {
		return "Invalid URL";
	}
}

interface DeepLinkSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function AppPicker({ onSelect }: { onSelect: (app: DeepLinkApp) => void }) {
	return (
		<Sheet.Body>
			<div className="grid grid-cols-3 gap-2">
				{DEEP_LINK_APPS.map((app) => (
					<button
						className="flex flex-col items-center gap-2.5 rounded-lg border border-border/60 bg-secondary/50 px-3 py-4 transition-colors hover:bg-interactive-hover"
						key={app.id}
						onClick={() => onSelect(app)}
						type="button"
					>
						<DeepLinkAppIcon appId={app.id} />
						<span className="font-medium text-xs">{app.name}</span>
					</button>
				))}
			</div>
		</Sheet.Body>
	);
}

function DeepLinkForm({
	app,
	onBack,
	onOpenChange,
}: {
	app: DeepLinkApp;
	onBack: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	const { activeOrganization, activeOrganizationId } =
		useOrganizationsContext();
	const createLink = useCreateLink();

	const form = useForm<DeepLinkFormData>({
		resolver: zodResolver(deepLinkFormSchema),
		mode: "onChange",
		defaultValues: { name: "", targetUrl: "", slug: "" },
	});

	const handleSubmit: SubmitHandler<DeepLinkFormData> = async (data) => {
		const targetUrl = ensureProtocol(data.targetUrl);
		const validationError = validateUrlForApp(data.targetUrl, app);
		if (validationError) {
			form.setError("targetUrl", { message: validationError });
			return;
		}

		const organizationId =
			activeOrganization?.id ?? activeOrganizationId ?? null;

		try {
			await createLink.mutateAsync({
				...(organizationId ? { organizationId } : {}),
				name: data.name,
				targetUrl,
				slug: data.slug?.trim() || undefined,
				deepLinkApp: app.id,
			});
			toast.success("Deep link created");
			onOpenChange(false);
		} catch (error: unknown) {
			toast.error(mapLinkApiError(error, false));
		}
	};

	const { isValid, isDirty } = form.formState;

	return (
		<form
			className="flex flex-1 flex-col overflow-hidden"
			onSubmit={form.handleSubmit(handleSubmit)}
		>
			<Sheet.Body className="space-y-6">
				<button
					className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
					onClick={onBack}
					type="button"
				>
					<ArrowLeftIcon className="size-3" />
					All apps
				</button>

				<div className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/50 px-3 py-2.5">
					<DeepLinkAppIcon appId={app.id} size={20} />
					<span className="font-medium text-sm">{app.name} Deep Link</span>
				</div>

				<Controller
					control={form.control}
					name="targetUrl"
					render={({ field, fieldState }) => (
						<Field error={!!fieldState.error}>
							<Field.Label>{app.name} URL</Field.Label>
							<Input
								placeholder={stripProtocol(app.placeholder)}
								prefix="https://"
								{...field}
								onChange={(e) => {
									field.onChange(normalizeUrlInput(e.target.value));
								}}
							/>
							<Field.Description>
								Paste a {app.name} link — on mobile, we'll open the app directly
							</Field.Description>
							{fieldState.error && (
								<Field.Error>{fieldState.error.message}</Field.Error>
							)}
						</Field>
					)}
				/>

				<div className="grid gap-4 sm:grid-cols-2">
					<Controller
						control={form.control}
						name="name"
						render={({ field, fieldState }) => (
							<Field error={!!fieldState.error}>
								<Field.Label>Name</Field.Label>
								<Input placeholder="My Instagram profile…" {...field} />
								{fieldState.error && (
									<Field.Error>{fieldState.error.message}</Field.Error>
								)}
							</Field>
						)}
					/>

					<Controller
						control={form.control}
						name="slug"
						render={({ field, fieldState }) => (
							<Field error={!!fieldState.error}>
								<Field.Label>
									Short Link{" "}
									<span className="text-muted-foreground">(optional)</span>
								</Field.Label>
								<Input
									placeholder="my-link"
									prefix={`${LINKS_BASE_URL}/`}
									{...field}
									onChange={(e) => {
										field.onChange(e.target.value.replace(/\s/g, "-"));
									}}
								/>
								{fieldState.error && (
									<Field.Error>{fieldState.error.message}</Field.Error>
								)}
							</Field>
						)}
					/>
				</div>
			</Sheet.Body>

			<Sheet.Footer>
				<Button
					onClick={() => onOpenChange(false)}
					type="button"
					variant="secondary"
				>
					Cancel
				</Button>
				<Button
					disabled={!(isValid && isDirty)}
					loading={createLink.isPending}
					type="submit"
				>
					Create Deep Link
				</Button>
			</Sheet.Footer>
		</form>
	);
}

export function DeepLinkSheet({ open, onOpenChange }: DeepLinkSheetProps) {
	const [selectedApp, setSelectedApp] = useState<DeepLinkApp | null>(null);

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			if (!isOpen) {
				setSelectedApp(null);
			}
			onOpenChange(isOpen);
		},
		[onOpenChange]
	);

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<Sheet.Content className="w-full sm:max-w-lg" side="right">
				<Sheet.Header>
					<Sheet.Title>
						{selectedApp ? `${selectedApp.name} Deep Link` : "Create Deep Link"}
					</Sheet.Title>
					<Sheet.Description>
						{selectedApp
							? `Paste a ${selectedApp.name} URL — on mobile, the short link will open the app directly.`
							: "Pick an app to create a deep link that opens directly in the native app on mobile."}
					</Sheet.Description>
				</Sheet.Header>

				{selectedApp ? (
					<DeepLinkForm
						app={selectedApp}
						onBack={() => setSelectedApp(null)}
						onOpenChange={handleOpenChange}
					/>
				) : (
					<AppPicker onSelect={setSelectedApp} />
				)}

				<Sheet.Close />
			</Sheet.Content>
		</Sheet>
	);
}
