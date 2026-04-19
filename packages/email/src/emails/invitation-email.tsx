import { Heading, Section, Text } from "react-email";
import { emailBrand } from "./email-brand";
import { EmailButton } from "./email-button";
import { EmailLayout } from "./email-layout";
import { EmailLinkFallback } from "./email-link-fallback";
import { EmailNote } from "./email-note";

interface InvitationEmailProps {
	invitationLink: string;
	inviterName: string;
	organizationName: string;
}

export const InvitationEmail = ({
	inviterName,
	organizationName,
	invitationLink,
}: InvitationEmailProps) => {
	const org = organizationName || "a team";
	const name = inviterName || "A team member";

	return (
		<EmailLayout preview={`Join ${org} on Databuddy`} tagline="Team Invitation">
			<Section className="text-center">
				<Heading
					className="m-0 mb-3 font-semibold text-xl tracking-tight"
					style={{ color: emailBrand.foreground }}
				>
					You're Invited!
				</Heading>
				<Text
					className="m-0 mb-6 text-sm leading-relaxed"
					style={{ color: emailBrand.muted }}
				>
					<span style={{ color: emailBrand.foreground, fontWeight: 500 }}>
						{name}
					</span>{" "}
					has invited you to join{" "}
					<span style={{ color: emailBrand.foreground, fontWeight: 500 }}>
						{org}
					</span>{" "}
					on Databuddy.
				</Text>
			</Section>
			<Section className="text-center">
				<EmailButton href={invitationLink}>Accept Invitation</EmailButton>
			</Section>
			<EmailNote>
				This invitation expires in 48 hours. If you weren't expecting this, you
				can safely ignore this email.
			</EmailNote>
			<EmailLinkFallback href={invitationLink} />
		</EmailLayout>
	);
};

InvitationEmail.PreviewProps = {
	invitationLink: "https://app.databuddy.cc/invite/abc123",
	inviterName: "Ada Lovelace",
	organizationName: "Acme Inc",
} satisfies InvitationEmailProps;

export default InvitationEmail;
