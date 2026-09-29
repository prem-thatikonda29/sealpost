"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, deleteEvent, type Event } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setEvents(await getEvents());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete event "${name}"?`)) return;
    await deleteEvent(id);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Saved certificate configurations"
        actions={
          <Link href="/events/new">
            <Button>+ New Event</Button>
          </Link>
        }
      />

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 hairline-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="rounded-lg border border-dashed border-hair-hover px-6 py-16 text-center">
          <p className="font-serif text-lg tracking-[-0.02em] text-foreground">
            No events yet
          </p>
          <p className="measure mx-auto mt-2 text-[13px] leading-relaxed text-muted-foreground">
            An event holds one certificate template and the rules for placing a
            name on it. Create one per award tier — winners, runners-up,
            participants — then reuse it for every batch you send.
          </p>
          <Link href="/events/new" className="mt-5 inline-block">
            <Button>Create your first event</Button>
          </Link>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 hairline-grid">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="group flex flex-col gap-3 p-5 transition-colors duration-150 hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {ev.name}
                </h2>
                {ev.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                    {ev.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {ev.template_path ? (
                  ev.text_position_x ? (
                    <Badge variant="ok">Ready</Badge>
                  ) : (
                    <Badge variant="warn">No position</Badge>
                  )
                ) : (
                  <Badge variant="warn">No template</Badge>
                )}
              </div>

              <dl className="font-mono text-[12px] text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="sr-only">Typography</dt>
                  <dd className="tabular">
                    {ev.font_size}px · {ev.font_style} · {ev.font_color}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="sr-only">Max text width</dt>
                  <dd className="tabular">max {ev.max_text_width}px</dd>
                </div>
              </dl>

              <div className="mt-auto flex items-center gap-2 pt-1">
                <Link href={`/events/${ev.id}`}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </Link>
                <Link href={`/run?event=${ev.id}`}>
                  <Button variant="outline" size="sm">
                    Run →
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:bg-rose hover:text-rose-ink"
                  onClick={() => handleDelete(ev.id, ev.name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
