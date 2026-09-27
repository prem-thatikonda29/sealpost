"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, deleteEvent, type Event } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete event "${name}"?`)) return;
    await deleteEvent(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saved certificate configurations
          </p>
        </div>
        <Link href="/events/new">
          <Button>+ New Event</Button>
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!loading && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No events yet.{" "}
            <Link href="/events/new" className="underline">
              Create your first one.
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((ev) => (
          <Card key={ev.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{ev.name}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  {ev.text_position_x ? (
                    <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 text-xs">
                      Position set
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 text-xs">
                      No position
                    </Badge>
                  )}
                  {ev.template_path ? null : (
                    <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 text-xs">
                      No template
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ev.description && (
                <p className="text-sm text-muted-foreground mb-3">{ev.description}</p>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Font: {ev.font_size}px · {ev.font_style} · {ev.font_color}</p>
                <p>Max width: {ev.max_text_width}px</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Link href={`/events/${ev.id}`}>
                  <Button variant="outline" size="sm">Edit</Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(ev.id, ev.name)}
                >
                  Delete
                </Button>
                <Link href={`/run?event=${ev.id}`} className="ml-auto">
                  <Button variant="outline" size="sm">Run →</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
