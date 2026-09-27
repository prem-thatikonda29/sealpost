"use client";

import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/api";
import { EventForm } from "@/components/EventForm";

export default function NewEventPage() {
  const router = useRouter();

  const handleSave = async (data: object) => {
    await createEvent(data as any);
    router.push("/events");
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">New Event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure a reusable certificate event
        </p>
      </div>
      <EventForm onSave={handleSave} />
    </div>
  );
}
