import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
	{
		question: "What do you mean by one layer?",
		answer:
			"Most teams use separate tools for analytics, error tracking, feature flags, and performance monitoring. Databuddy combines all of these into one connected system, so you see the full picture without switching tabs or paying for multiple subscriptions.",
	},
	{
		question: "How is this different from Google Analytics?",
		answer:
			"Databuddy is under 30 KB (vs GA4's 45KB+), requires no cookies, and is GDPR compliant by default. Beyond analytics, it includes error tracking, web vitals, funnels, and feature flags. Things you'd need separate tools for with GA.",
	},
	{
		question: "Do I need cookie consent banners?",
		answer:
			"No. Databuddy doesn't use cookies or track individual users. You can remove those banners entirely and stay compliant with GDPR and CCPA.",
	},
	{
		question: "What's included in the free plan?",
		answer:
			"Up to 10,000 monthly events, real-time analytics, error tracking, and basic feature flags. Enough for most small projects and side projects.",
	},
	{
		question: "How long does setup take?",
		answer:
			"Under 5 minutes. Add a single script tag or use our SDK for Next.js, React, Vue, or vanilla JS. Data shows up immediately.",
	},
];

export default function FAQ() {
	return (
		<div className="w-full px-8">
			<div className="space-y-8 lg:space-y-12">
				{/* Header Section */}
				<div className="text-center lg:text-left">
					<h2 className="mx-auto max-w-2xl font-medium text-2xl leading-tight sm:text-3xl lg:mx-0 lg:text-4xl xl:text-5xl">
						Frequently asked questions
					</h2>
				</div>

				{/* FAQ Accordion */}
				<div className="w-full">
					<Accordion className="w-full" collapsible type="single">
						{faqs.map((faq) => (
							<AccordionItem
								className="border-l-4 border-l-transparent bg-background/50 duration-200 hover:border-l-primary/20 hover:bg-background/80"
								key={faq.question}
								value={faq.question}
							>
								<AccordionTrigger className="px-8 py-4 text-left font-normal text-base hover:no-underline sm:py-6 sm:text-lg lg:text-xl">
									{faq.question}
								</AccordionTrigger>
								<AccordionContent className="px-8 pb-4 text-muted-foreground text-sm leading-relaxed sm:pb-6 sm:text-base">
									{faq.answer}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</div>
	);
}
