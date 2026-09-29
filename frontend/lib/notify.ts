"use client";

import { useToastManager } from "@/components/ui/toast";

/**
 * The app's one way to report an outcome.
 *
 * A wrapper rather than calling `useToastManager` directly, so the two things
 * that are easy to get wrong stay in one place: a failure needs longer on
 * screen than a success, and it should be announced urgently rather than
 * queued politely behind whatever the screen reader was already saying.
 *
 * `<Toaster />` is mounted once in the root layout, so every page is covered —
 * and a toast survives the route change a save triggers, which is why the save
 * handlers can report success and then navigate.
 */
export function useNotify() {
  const { add } = useToastManager();

  return {
    success(title: string, description?: string) {
      add({ title, description, type: "success" });
    },
    error(title: string, description?: string) {
      add({
        title,
        description,
        type: "error",
        // The 5s default is tuned for "that worked"; a message the user has to
        // read and act on gets longer.
        timeout: 8000,
        priority: "high",
      });
    },
  };
}
