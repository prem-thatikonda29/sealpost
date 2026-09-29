"use client";

import {
  Lightning,
  EnvelopeSimple,
  ArrowClockwise,
  PaintBrush,
  ChartBarHorizontal,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useReveal } from "./useReveal";

const features = [
  {
    icon: Lightning,
    title: "Batch Generation",
    description: "Generate hundreds of certificates from a CSV in seconds",
    color: "bg-accent-terra",
    textColor: "text-accent-terra-text",
  },
  {
    icon: EnvelopeSimple,
    title: "Email Delivery",
    description: "Send personalized certificates directly via Gmail SMTP",
    color: "bg-accent-sage",
    textColor: "text-accent-sage-text",
  },
  {
    icon: ArrowClockwise,
    title: "Re-send Failures",
    description:
      "Retry only the rows that missed out, with a message you can rewrite",
    color: "bg-accent-amber",
    textColor: "text-accent-amber-text",
  },
  {
    icon: PaintBrush,
    title: "Custom Templates",
    description: "Multiple tiers with unique templates for winners, runners-up, and participants",
    color: "bg-accent-terra",
    textColor: "text-accent-terra-text",
  },
  {
    icon: ChartBarHorizontal,
    title: "Generate & Download",
    description:
      "Generate every certificate and download the zip without sending a single email",
    color: "bg-accent-sage",
    textColor: "text-accent-sage-text",
  },
  {
    icon: ShieldCheck,
    title: "Rate Control",
    description: "Configurable batch sizes to respect SMTP rate limits",
    color: "bg-accent-rose",
    textColor: "text-accent-rose-text",
  },
];

export default function Features() {
  const ref = useReveal();

  return (
    <section id="features" className="py-24 md:py-32">
      <div ref={ref} className="reveal">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
          Features
        </h2>
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Everything you need to generate and deliver hackathon certificates at scale.
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-surface p-6 md:p-8 transition-colors duration-150 hover:bg-surface-raised"
            >
              <div className={`inline-flex p-2 ${feature.color}`}>
                <feature.icon className={`w-4 h-4 ${feature.textColor}`} weight="fill" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-text">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
