// src/types/flip.ts

/* =========================
 * Backend-kompatible Modelle
 * ========================= */

export type UUID = string;

/** Flip „leichtgewichtig“ (wie von /api/personal/flip) */
export interface FlipAttributeKV {
  name: string;
  value: string | number | boolean | null;
}

export interface FlipProfile {
  department?: string | null;
  job_title?: string | null;
  location?: string | null;
}

export interface FlipPrimaryUserGroup {
  id: UUID | null;
  title?: string | null;
  language?: string | null;
  status?: string | null;
}

export interface IFlipUser {
  id: UUID | null;
  external_id?: string | null;

  vorname?: string | null;     // mapped (first_name)
  nachname?: string | null;    // mapped (last_name)
  email?: string | null;
  status?: "ACTIVE" | "LOCKED" | "PENDING_DELETION" | string;
  benutzername?: string | null; // mapped (username)

  erstellungsdatum?: string | null;     // created_at
  aktualisierungsdatum?: string | null; // updated_at
  loeschdatum?: string | null;          // deletion_at

  profilbild?: string | null; // file_id
  rolle?: "USER" | "ADMIN" | string;
  required_actions?: string[];

  profile?: FlipProfile | null;
  attributes?: FlipAttributeKV[] | null;

  primary_user_group?: FlipPrimaryUserGroup;

  // optional Zusatzfelder aus anderen Endpunkten
  groups?: Array<{ id: UUID; name: string }>;
}

/** Flip-Task (vereinheitlicht) */
export interface IFlipTask {
  id: UUID | null;
  external_id?: string | null;
  correlation_id?: string | null;
  author_id?: UUID | null;
  title?: string | null;
  recipients?: any; // unverändert, Flip API Struktur

  body?: {
    plain?: string | null;
    delta?: any[];
    html?: string | null;
    language?: string | null;
  };

  settings?: {
    comments_enabled: boolean;
    comments_count?: number;
  };

  due_at?: {
    date?: string;
    type?: "DATE" | "DATE_TIME";
  };

  progress_status?: "OPEN" | "IN_PROGRESS" | "DONE" | string;
  distribution_kind?: "PERSONAL" | string;

  created_at?: string | null;
  updated_at?: string | null;

  assignment_summary?: {
    total: number;
    items: Array<{ count: number; status: string }>;
  };
}

/** Flip UserGroup (vereinfacht) */
export interface IFlipUserGroup {
  group_id: UUID | null;
  external_id?: string | null;
  title: Array<{ language: string | null; text: string | null }>;
  status: string;
  type: string;
  path: Array<{
    id: UUID | null;
    title: { language: string | null; text: string | null };
    status: string | null;
  }>;
  description: Array<{ language: string | null; text: string | null }>;
  parent_id: UUID | null;
  number_of_contained_users: number;
  actions: {
    archive: boolean;
    assign_member: boolean;
    delete: boolean;
    edit: boolean;
    create_subgroup: boolean;
    manage_channels: boolean;
    restore: boolean;
    manage_branding: boolean;
  };
}

/* ================
 * Mitarbeiter (DB)
 * ================ */

export interface IMitarbeiter {
  _id: string;
  flip_id?: UUID | null;
  asana_id?: string | null;
  vorname: string;
  nachname: string;
  erstellt_von?: string | null;
  email?: string | null;
  isActive: boolean;

  laufzettel_received?: Array<{ _id: string; name?: string }>;
  laufzettel_submitted?: Array<{ _id: string; name?: string }>;
  eventreports?: Array<{ _id: string; title?: string; datum?: string }>;
  evaluierungen_received?: Array<{ _id: string; score?: number }>;
  evaluierungen_submitted?: Array<{ _id: string; score?: number }>;

  dateCreated: string;

  // clientseitig angereichert
  flip?: IFlipUser | null;
}

/* ================
 * Dokumente (DB)
 * ================ */

export interface ILaufzettel {
  _id: string;
  location: string;
  name_mitarbeiter: string;
  name_teamleiter: string;
  mitarbeiter?: IMitarbeiter | string | null;
  teamleiter?: IMitarbeiter | string | null;
  assigned: boolean;
  task_id?: string | null;
  datum?: string | Date | { unix: number } | null;
  date: string;
}

export interface IEventReport {
  _id: string;
  location: string;
  name_teamleiter: string;
  datum: string | Date | { unix: number };
  kunde: string;
  puenktlichkeit?: string;
  erscheinungsbild?: string;
  team?: string;
  mitarbeiter_job?: string;
  feedback_auftraggeber?: string;
  sonstiges?: string;
  teamleiter?: IMitarbeiter | string | null;
  assigned: boolean;
  date: string;
}

export interface IEvaluierungMA {
  _id: string;
  location: string;
  datum?: string | Date | { unix: number };
  kunde: string;
  name_teamleiter: string;
  name_mitarbeiter: string;
  puenktlichkeit?: string;
  grooming?: string;
  motivation?: string;
  technische_fertigkeiten?: string;
  lernbereitschaft?: string;
  sonstiges?: string;
  mitarbeiter?: IMitarbeiter | string | null;
  teamleiter?: IMitarbeiter | string | null;
  laufzettel?: ILaufzettel | string | null;
  assigned: boolean;
  date: string;
}

/* =========================
 * Frontend-Helfer / Mappings
 * ========================= */

export type PicEntry = {
  url?: string;
  ts?: number;
  promise?: Promise<string>;
};

export type MitarbeiterFilters = Partial<{
  sortField: keyof IMitarbeiter | "dateCreated";
  sortOrder: "asc" | "desc";
}> & Record<string, string | boolean | null | undefined>;
