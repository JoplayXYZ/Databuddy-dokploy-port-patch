"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { SectionBullet } from "../icons/section-bullet";

export interface FaqItem {
	answer: string;
	question: string;
}

interface FaqSectionProps {
	className?: string;
	eyebrow?: string;
	items: FaqItem[];
	subtitle?: string;
	title?: string;
}

export function FaqSection({
	eyebrow,
	title = "Frequently asked questions.",
	subtitle,
	items,
	className,
}: FaqSectionProps) {
	return (
		<div className={cn("mx-auto w-full max-w-7xl", className)}>
			<div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
				<div className="flex gap-4 sm:sticky sm:top-8 sm:w-94 sm:shrink-0 sm:self-start">
					<span className="mt-2">
						<SectionBullet color="#CD5F20" />
					</span>
					<div>
						<h2 className="text-balance font-medium text-3xl tracking-tight sm:text-5xl">
							{title}
						</h2>
						{subtitle ? (
							<p className="mt-2 text-pretty text-muted-foreground text-sm sm:text-base">
								{subtitle}
							</p>
						) : null}
					</div>
				</div>

				<Accordion className="w-full min-w-0" collapsible type="single">
					{items.map((faq) => (
						<AccordionItem
							className="accordion-item"
							key={faq.question}
							value={faq.question}
						>
							<AccordionTrigger className="px-5 py-4 text-left font-normal text-sm hover:no-underline sm:px-6 sm:py-5 sm:text-base">
								{faq.question}
							</AccordionTrigger>
							<AccordionContent className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed sm:px-6 sm:pb-5">
								{faq.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</div>
	);
}
