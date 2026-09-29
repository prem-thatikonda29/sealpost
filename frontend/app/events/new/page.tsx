"use client";

import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/api";
import { EventForm } from "@/components/EventForm";
import { PageHeader } from "@/components/PageHeader";
import { useNotify } from "@/lib/notify";

export default function NewEventPage() {
  const router = useRouter();
  const notify = useNotify();

  const handleSave = async (data: object) => {
    try {
      await createEvent(data as any);
    } catch (e: any) {
      // The form has no post-save behaviour, so a rejected save used to become
      // an unhandled rejection and the button just stopped saying "Saving…".
      notify.error(
        "Could not create the event",
        e?.response?.data?.detail ?? e?.message
      );
      return;
    }
    notify.success("Event created");
    router.push("/events");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Event"
        subtitle="Configure a reusable certificate event"
      />
      <EventForm onSave={handleSave} />
    </div>
  );
}
