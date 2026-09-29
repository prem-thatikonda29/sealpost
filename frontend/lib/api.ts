import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({ baseURL: BASE });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  description?: string;
  template_path?: string;
  template_natural_width?: number;
  template_natural_height?: number;
  text_position_x?: number;
  text_position_y?: number;
  font_path?: string;
  font_size: number;
  font_style: string;
  font_color: string;
  max_text_width: number;
  created_at: string;
}

export interface JobRow {
  id: number;
  job_id: string;
  row_index: number;
  name: string;
  email: string;
  status: string;
  error_message?: string;
}

export interface Job {
  id: string;
  event_id?: string;
  event_name?: string;
  status: string;
  total_rows: number;
  sent_count: number;
  failed_count: number;
  invalid_count: number;
  bounced_count: number;
  dry_run: boolean;
  created_at: string;
  finished_at?: string;
  rows?: JobRow[];
}

export interface TemplateUpload {
  template_id: string;
  path: string;
  url: string;
  natural_width: number;
  natural_height: number;
}

export interface FontEntry {
  id: string;
  label: string;
  category: string;
  path: string;
  /** Absolute — the API returns a path and this layer makes it a URL. */
  url: string;
  /** Which of normal / bold / italic this family has real files for. */
  styles: string[];
  google_family: string;
}

export interface FontUpload {
  font_id: string;
  path: string;
  url: string;
  family: string;
  style: string;
}

export interface EmailValidation {
  email: string;
  valid: boolean;
  reason: string;
}

export interface DuplicateRecipient {
  email: string;
  name: string;
  sent_at?: string;
}

export interface DuplicateCheck {
  /** Distinct addresses looked up. */
  checked: number;
  /** How many of those already received a certificate for this event. */
  already_sent: number;
  /**
   * Whether the check was confined to one event. When false it can only say
   * "sent something before", and the copy must not claim more.
   */
  scoped_to_event: boolean;
  /** A few of them, so the warning can name names rather than only count. */
  sample: DuplicateRecipient[];
}

// ─── Events ───────────────────────────────────────────────────────────────────

export const getEvents = () => api.get<Event[]>("/api/events").then((r) => r.data);

export const getEvent = (id: string) =>
  api.get<Event>(`/api/events/${id}`).then((r) => r.data);

export const createEvent = (data: Partial<Event> & { save?: boolean }) =>
  api.post<Event>("/api/events", data).then((r) => r.data);

export const updateEvent = (id: string, data: Partial<Event>) =>
  api.put<Event>(`/api/events/${id}`, data).then((r) => r.data);

export const deleteEvent = (id: string) => api.delete(`/api/events/${id}`);

// ─── Templates ────────────────────────────────────────────────────────────────

export const uploadTemplate = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<TemplateUpload>("/api/templates/upload", form).then((r) => r.data);
};

export const templateUrl = (path: string) => {
  // path stored in DB is e.g. "uploads/<uuid>_filename.jpg"
  // UUID is exactly 36 chars (8-4-4-4-12 with hyphens) — extract by fixed length
  const filename = path.split("/").pop() ?? "";
  const id = filename.length >= 36 ? filename.slice(0, 36) : filename;
  return `${BASE}/api/templates/${id}`;
};

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const listFonts = () =>
  api
    .get<FontEntry[]>("/api/fonts")
    .then((r) => r.data.map((f) => ({ ...f, url: `${BASE}${f.url}` })));

export const uploadFont = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<FontUpload>("/api/fonts/upload", form)
    .then((r) => ({ ...r.data, url: `${BASE}${r.data.url}` }));
};

/**
 * The URL for a stored font_path.
 *
 * Catalog fonts are stored as their repo-relative path and resolved through the
 * catalog; uploaded fonts are stored as `uploads/fonts/<uuid>_<name>` and
 * resolved by the UUID, which both serving routes accept as `font_id`.
 */
export const fontFileUrl = (path: string, catalog: FontEntry[]): string => {
  if (!path) return "";
  if (path.startsWith("uploads/")) {
    const filename = path.split("/").pop() ?? "";
    return filename.length >= 36 ? `${BASE}/api/fonts/${filename.slice(0, 36)}/file` : "";
  }
  return catalog.find((f) => f.path === path)?.url ?? "";
};

// ─── Preview ──────────────────────────────────────────────────────────────────

export const fetchPreview = async (params: {
  template_path: string;
  text_position_x: number;
  text_position_y: number;
  font_path?: string;
  font_size: number;
  font_style: string;
  font_color: string;
  max_text_width: number;
  sample_name?: string;
}): Promise<string> => {
  const res = await api.post("/api/preview", params, { responseType: "blob" });
  return URL.createObjectURL(res.data);
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const createJob = (config: object, csvFile: File) => {
  const form = new FormData();
  form.append("config", JSON.stringify(config));
  form.append("csv_file", csvFile);
  return api.post<{ job_id: string }>("/api/jobs", form).then((r) => r.data);
};

export const getJob = (id: string) =>
  api.get<Job>(`/api/jobs/${id}`).then((r) => r.data);

export const listJobs = () => api.get<Job[]>("/api/jobs").then((r) => r.data);

export const validateEmails = (emails: string[]) =>
  api
    .post<EmailValidation[]>("/api/jobs/validate-emails", { emails })
    .then((r) => r.data);

/**
 * Which of these addresses have already had a certificate for this event.
 *
 * Called before a job starts, not as part of it — the answer decides whether the
 * user is asked to confirm, so it has to arrive before anything is sent.
 *
 * `eventId` may be empty for a job with no saved event. The check then widens
 * to every past send, and says so.
 */
export const checkDuplicates = (eventId: string | null | undefined, emails: string[]) =>
  api
    .post<DuplicateCheck>("/api/jobs/check-duplicates", {
      event_id: eventId || null,
      emails,
    })
    .then((r) => r.data);
