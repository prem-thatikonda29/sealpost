"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEvent, updateEvent, type Event } from "@/lib/api";
import { EventForm } from "@/components/EventForm";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEvent(id).then(setEvent);
  }, [id]);

  const handleSave = async (data: Partial<Event>) => {
    setSaving(true);
    try {
      await updateEvent(id, data);
      router.push("/events");
    } finally {
      setSaving(false);
    }
  };

  if (!event) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Edit Event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{event.name}</p>
      </div>
      <EventForm initial={event} onSave={handleSave} saving={saving} />
    </div>
  );
}
