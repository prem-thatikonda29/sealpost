"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  /** The trigger button's label. */
  children: React.ReactNode;
  /** Extra classes for the trigger, which is a ghost button by default. */
  triggerClassName?: string;
  title: string;
  /** What is about to happen, and what it costs. Say the consequence. */
  description?: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while the work runs. */
  busyLabel?: string;
  /**
   * Runs on confirm. The dialog stays open, showing `busyLabel`, until this
   * settles — so on failure the user can read the error and try again rather
   * than being returned to a page where nothing happened.
   */
  onConfirm: () => Promise<void> | void;
}

/**
 * Destructive confirmation, in the app's own dialog.
 *
 * Replaces `window.confirm`, which is the one surface that ignores the
 * palette, the type and the radius, and renders differently on every platform.
 * Confirmation is never a bare "OK / Cancel": the button names the action, so
 * the choice stays legible after the description has scrolled out of mind.
 */
export function ConfirmDialog({
  children,
  triggerClassName,
  title,
  description,
  confirmLabel = "Delete",
  busyLabel,
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      // Dismissing mid-flight would leave the work running with nothing to
      // report it, so the dialog holds until the promise settles.
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className={triggerClassName} />}
      >
        {children}
      </DialogTrigger>

      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
