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
  /**
   * The trigger button's label. Omit when driving the dialog with `open` —
   * a confirmation that follows from another action has no button of its own.
   */
  children?: React.ReactNode;
  /** Extra classes for the trigger, which is a ghost button by default. */
  triggerClassName?: string;
  /** Controlled mode. When set, no trigger renders and the caller owns `open`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  /** What is about to happen, and what it costs. Say the consequence. */
  description?: React.ReactNode;
  /** Detail between the description and the buttons — a list, say. */
  body?: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while the work runs. */
  busyLabel?: string;
  /**
   * `destructive` for something that destroys; `default` for something risky
   * but reversible. Red on the confirm button is a claim about what the action
   * does — a duplicate send is a mistake, not a deletion.
   */
  confirmVariant?: "destructive" | "default";
  /**
   * Runs on confirm. The dialog stays open, showing `busyLabel`, until this
   * settles — so on failure the user can read the error and try again rather
   * than being returned to a page where nothing happened. It should not throw;
   * handle the failure itself.
   */
  onConfirm: () => Promise<void> | void;
}

/**
 * Confirmation before something irreversible, in the app's own dialog.
 *
 * Replaces `window.confirm`, which is the one surface that ignores the
 * palette, the type and the radius, and renders differently on every platform.
 * Confirmation is never a bare "OK / Cancel": the button names the action, so
 * the choice stays legible after the description has scrolled out of mind.
 */
export function ConfirmDialog({
  children,
  triggerClassName,
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmLabel = "Delete",
  busyLabel,
  confirmVariant = "destructive",
  onConfirm,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

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
      open={isOpen}
      // Dismissing mid-flight would leave the work running with nothing to
      // report it, so the dialog holds until the promise settles.
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      {children !== undefined && (
        <DialogTrigger
          render={<Button variant="ghost" size="sm" className={triggerClassName} />}
        >
          {children}
        </DialogTrigger>
      )}

      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {body}

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
            variant={confirmVariant}
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
