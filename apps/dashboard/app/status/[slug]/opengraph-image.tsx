import { ImageResponse } from "next/og";
import { publicRPCClient } from "@/lib/orpc-public";

export const revalidate = 60;
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const STATUS_COLORS = {
	operational: { bg: "#059669", label: "All Systems Operational" },
	degraded: { bg: "#d97706", label: "Partial System Outage" },
	outage: { bg: "#dc2626", label: "Major System Outage" },
} as const;

export default async function OGImage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const data = await publicRPCClient.statusPage
		.getBySlug({ slug })
		.catch(() => null);

	const orgName = data?.organization.name ?? "Status Page";
	const status = data?.overallStatus ?? "operational";
	const config = STATUS_COLORS[status];

	const overallUptime =
		data && data.monitors.length > 0
			? data.monitors.reduce((sum, m) => sum + m.uptimePercentage, 0) /
				data.monitors.length
			: 0;

	return new ImageResponse(
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				justifyContent: "flex-end",
				backgroundColor: "#0a0a0a",
				padding: "60px 80px",
				position: "relative",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "-40%",
					left: "20%",
					width: "800px",
					height: "600px",
					background:
						"radial-gradient(ellipse at center, rgba(255, 255, 255, 0.06), transparent 70%)",
					transform: "rotate(-15deg)",
				}}
			/>

			<div
				style={{
					position: "absolute",
					top: "60px",
					left: "80px",
					display: "flex",
					alignItems: "center",
					gap: "16px",
				}}
			>
				<svg
					height="44"
					style={{ borderRadius: "4px" }}
					viewBox="0 0 8 8"
					width="44"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Databuddy</title>
					<path d="M0 0h8v8H0z" fill="#000" />
					<path
						d="M1 1h1v6H1zm1 0h4v1H2zm4 1h1v1H6zm0 1h1v1H6zm0 1h1v1H6zm0 1h1v1H6zM2 6h4v1H2zm1-3h1v1H3zm1 1h1v1H4z"
						fill="#fff"
					/>
				</svg>
				<span
					style={{
						color: "#ffffff",
						fontSize: "22px",
						fontWeight: 600,
						fontFamily: "monospace",
						letterSpacing: "0.1em",
						textTransform: "uppercase",
					}}
				>
					Databuddy
				</span>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					marginBottom: "24px",
					padding: "8px 16px",
					backgroundColor: `${config.bg}20`,
					borderRadius: "9999px",
					border: `1px solid ${config.bg}40`,
				}}
			>
				<div
					style={{
						width: "8px",
						height: "8px",
						borderRadius: "9999px",
						backgroundColor: config.bg,
					}}
				/>
				<span
					style={{
						color: config.bg,
						fontSize: "14px",
						fontWeight: 600,
					}}
				>
					{config.label}
				</span>
			</div>

			<h1
				style={{
					color: "#ffffff",
					fontSize: orgName.length > 30 ? "48px" : "60px",
					fontWeight: 700,
					lineHeight: 1.1,
					letterSpacing: "-0.03em",
					marginBottom: "16px",
					maxWidth: "900px",
				}}
			>
				{orgName} Status
			</h1>

			{overallUptime > 0 ? (
				<p
					style={{
						color: "#737373",
						fontSize: "24px",
						lineHeight: 1.5,
					}}
				>
					{overallUptime.toFixed(2)}% uptime across {data?.monitors.length ?? 0}{" "}
					services
				</p>
			) : null}

			<div
				style={{
					position: "absolute",
					bottom: "60px",
					right: "80px",
					display: "flex",
					alignItems: "center",
					gap: "8px",
				}}
			>
				<span
					style={{
						color: "#525252",
						fontSize: "18px",
						fontFamily: "monospace",
					}}
				>
					databuddy.cc/status
				</span>
			</div>
		</div>,
		{ ...size }
	);
}
