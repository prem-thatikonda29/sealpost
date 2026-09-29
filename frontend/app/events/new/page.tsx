"use client";

import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/api";
import { EventForm } from "@/components/EventForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewEventPage() {
  const router = useRouter();

  const handleSave = async (data: object) => {
    await createEvent(data as any);
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
