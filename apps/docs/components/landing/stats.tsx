const stats = [
	{ value: "500+", label: "Websites tracked" },
	{ value: "2,000+", label: "Developers" },
	{ value: "10M+", label: "Events per month" },
];

export function Stats() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 py-8 sm:gap-x-16 lg:gap-x-20">
			{stats.map((stat) => (
				<div className="flex flex-col items-center gap-1" key={stat.label}>
					<span className="font-semibold text-2xl text-foreground tabular-nums sm:text-3xl">
						{stat.value}
					</span>
					<span className="text-muted-foreground text-sm">{stat.label}</span>
				</div>
			))}
		</div>
	);
}
