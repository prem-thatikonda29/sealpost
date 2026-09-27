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
  url: string;
  natural_width: number;
  natural_height: number;
}

export interface EmailValidation {
  email: string;
  valid: boolean;
  reason: string;
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
  // extract uuid prefix
  const id = path.split("/").pop()?.split("_")[0] ?? "";
  return `${BASE}/api/templates/${id}`;
};

// ─── Preview ──────────────────────────────────────────────────────────────────

export const getPreviewUrl = (params: {
  template_path: string;
  text_position_x: number;
  text_position_y: number;
  font_path?: string;
  font_size: number;
  font_style: string;
  font_color: string;
  max_text_width: number;
  sample_name?: string;
}): string => {
  // Returns a URL we can POST to — used by CertPreview via fetch
  return `${BASE}/api/preview`;
};

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
