"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";

/** Fixed width, so the mask doesn't leak how long an address is. */
const MASKED_EMAIL = "************";

/**
 * Participant addresses are personal data and these screens are often shared,
 * so every place that lists them hides them until the user asks.
 *
 * The mask is hidden from assistive tech and replaced with a spoken "hidden",
 * otherwise a screen reader reads out twelve asterisks. A blank value stays
 * blank so "no email" is still visible.
 */
export function EmailText({
  email,
  shown,
}: {
  email: string | null | undefined;
  shown: boolean;
}) {
  const value = email ?? "";
  if (shown) return <>{value}</>;
  if (!value.trim()) return null;
  return (
    <>
      <span aria-hidden="true">{MASKED_EMAIL}</span>
      <span className="sr-only">Email hidden</span>
    </>
  );
}

interface Props {
  shown: boolean;
  onToggle: () => void;
}

/**
 * The eye button that flips a list of emails between masked and visible.
 * The icon is small to sit in a table header, so the pseudo-element widens the
 * clickable area to a comfortable touch target without moving the layout.
 */
export function EmailToggle({ shown, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide email addresses" : "Show email addresses"}
      title={shown ? "Hide emails" : "Show emails"}
      className="relative rounded p-0.5 text-muted-foreground transition-colors after:absolute after:-inset-2.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {shown ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
    </button>
  );
}
