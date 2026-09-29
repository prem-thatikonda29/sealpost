"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEvent, updateEvent, type Event } from "@/lib/api";
import { EventForm } from "@/components/EventForm";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

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
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-[540px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Event" subtitle={event.name} />
      <EventForm initial={event} onSave={handleSave} saving={saving} />
    </div>
  );
}
