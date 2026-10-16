"use client";

import {
  Lightning,
  EnvelopeSimple,
  ArrowClockwise,
  PaintBrush,
  ChartBarHorizontal,
  Broom,
  SealCheck,
  Gauge,
  FileCsv,
} from "@phosphor-icons/react";
import { useReveal } from "./useReveal";

const features = [
  {
    icon: Lightning,
    title: "Batch Generation",
    description:
      "Make hundreds of certificates from a single spreadsheet",
    color: "bg-accent-terra",
    textColor: "text-accent-terra-text",
  },
  {
    icon: EnvelopeSimple,
    title: "Email Delivery",
    description:
      "Send each certificate straight from your own Gmail",
    color: "bg-accent-sage",
    textColor: "text-accent-sage-text",
  },
  {
    icon: Broom,
    title: "List Cleaning",
    description:
      "Fixes ALL CAPS names and stray spaces for you, and points out repeats, missing names and wrong email addresses before you send",
    color: "bg-accent-amber",
    textColor: "text-accent-amber-text",
  },
  {
    icon: SealCheck,
    title: "Address Checks",
    description:
      "Spots typos like gmial.com before anything goes out, and warns you before sending to someone who already has theirs",
    color: "bg-accent-rose",
    textColor: "text-accent-rose-text",
  },
  {
    icon: Gauge,
    title: "Safe Sending",
    description:
      "Emails go out at a steady pace to stay within Gmail's limits. If you reach the daily limit, the run stops and you finish tomorrow",
    color: "bg-accent-terra",
    textColor: "text-accent-terra-text",
  },
  {
    icon: FileCsv,
    title: "Delivery Report",
    description:
      "See who got their certificate and who didn't, and why. Download it all as a spreadsheet",
    color: "bg-accent-sage",
    textColor: "text-accent-sage-text",
  },
  {
    icon: ArrowClockwise,
    title: "Re-send Failures",
    description:
      "Retry only the people who missed out, with a message you can rewrite",
    color: "bg-accent-amber",
    textColor: "text-accent-amber-text",
  },
  {
    icon: PaintBrush,
    title: "Custom Templates",
    description:
      "A different design for winners, runners-up and participants, with a library of fonts or your own",
    color: "bg-accent-rose",
    textColor: "text-accent-rose-text",
  },
  {
    icon: ChartBarHorizontal,
    title: "Generate & Download",
    description:
      "Make every certificate and download them as a zip, without sending a single email",
    color: "bg-accent-terra",
    textColor: "text-accent-terra-text",
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
