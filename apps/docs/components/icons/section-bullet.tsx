interface SectionBulletProps {
	color: string;
}

export function SectionBullet({ color }: SectionBulletProps) {
	return (
		<div>
			<svg
				className="h-6 w-4 sm:h-7 sm:w-5 md:h-8 md:w-6"
				fill="none"
				viewBox="0 0 26 39"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect fill={color} height="13" width="13" />
				<rect fill={color} height="13" width="13" x="13" y="13" />
				<rect fill={color} height="13" width="13" y="26" />
			</svg>
		</div>
	);
}
