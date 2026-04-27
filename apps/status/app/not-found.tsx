export default function NotFound() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
			<div className="flex w-full max-w-sm flex-col items-center text-center">
				<p className="font-semibold text-[13px] text-muted-foreground uppercase tracking-[0.15em]">
					404
				</p>
				<h1 className="mt-2 text-balance font-semibold text-foreground text-lg">
					Status page not found
				</h1>
				<p className="mt-2 text-pretty text-muted-foreground text-sm leading-relaxed">
					This status page doesn&apos;t exist or the URL is incorrect.
				</p>
				<a
					className="mt-6 font-medium text-foreground text-sm hover:underline"
					href="https://www.databuddy.cc"
					rel="noopener noreferrer"
				>
					Go to Databuddy
				</a>
			</div>
		</div>
	);
}
