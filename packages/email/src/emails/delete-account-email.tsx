import { Heading, Section, Text } from "react-email";
import { emailBrand } from "./email-brand";
import { EmailButton } from "./email-button";
import { EmailLayout } from "./email-layout";
import { EmailLinkFallback } from "./email-link-fallback";
import { EmailNote } from "./email-note";

interface DeleteAccountEmailProps {
	url: string;
}

export const DeleteAccountEmail = ({ url }: DeleteAccountEmailProps) => (
	<EmailLayout
		preview="Confirm your account deletion"
		tagline="Account Deletion Request"
	>
		<Section className="text-center">
			<Heading
				className="m-0 mb-3 font-semibold text-xl tracking-tight"
				style={{ color: emailBrand.foreground }}
			>
				Confirm Account Deletion
			</Heading>
			<Text
				className="m-0 mb-6 text-sm leading-relaxed"
				style={{ color: emailBrand.muted }}
			>
				You requested to permanently delete your Databuddy account. This action
				is irreversible — all your data, organizations, and connected accounts
				will be removed.
			</Text>
		</Section>
		<Section className="text-center">
			<EmailButton href={url}>Delete My Account</EmailButton>
		</Section>
		<EmailNote>
			This link expires in 1 hour. If you didn't request this, you can safely
			ignore this email — your account will not be deleted.
		</EmailNote>
		<EmailLinkFallback href={url} />
	</EmailLayout>
);

DeleteAccountEmail.PreviewProps = {
	url: "https://app.databuddy.cc/delete-account/abc123",
} satisfies DeleteAccountEmailProps;

export default DeleteAccountEmail;
