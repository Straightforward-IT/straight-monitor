// src/stores/flipAll.ts
import { defineStore } from "pinia";
import { useDataCache } from "./dataCache";
import FlipMappings from "@/assets/FlipMappings.json";
import {
  fetchFlipUsers,
  fetchFlipProfilePicture,
  fetchMitarbeiters,
  patchMitarbeiter,
  runInitialRoutine,
  runAsanaRoutine,
  getMissingAsanaRefs,
  listDuplicateFlipId,
  listDuplicateAsanaId,
  listDuplicateEmail,
  listUsernameEmailDifferences,
  fetchFlipUserById,
  patchFlipUser,
  getFlipUserGroups,
  assignFlipUserGroups,
  assignFlipTask,
  getFlipAssignments,
  getFlipTaskAssignments,
  completeFlipAssignment,
  deleteMitarbeiterMany,
} from "../utils/flipApi";

import type {
  IFlipUser,
  IMitarbeiter,
  PicEntry,
  MitarbeiterFilters,
  IFlipUserGroup,
} from "../types/flip";

// Teamleiter UserGroup IDs from FlipMappings
const TEAMLEITER_GROUP_IDS = [
  FlipMappings.user_group_ids.berlin_teamleiter,
  FlipMappings.user_group_ids.hamburg_teamleiter,
  FlipMappings.user_group_ids.koeln_teamleiter,
];

export const useFlipAll = defineStore("flipAll", {
  state: () => ({
    // Flip-Users
    loaded: false,
    loading: false,
    error: null as string | null,

    byId: new Map<string, IFlipUser>(),
    byEmail: new Map<string, IFlipUser>(),

    // Mitarbeiter (optional gecacht)
    mitarbeiterLoaded: false,
    mitarbeiterLoading: false,
    mitarbeiterError: null as string | null,
    mitarbeiters: [] as IMitarbeiter[],

    // Profile-Picture Cache (ObjectURLs)
    enablePhotos: true,
    pics: new Map<string, PicEntry>(),
    picTTL: 60 * 60 * 1000, // 1h
  }),

  getters: {
    getById: (s) => (id?: string) => (id ? s.byId.get(id) : undefined),
    getByEmail: (s) => (email?: string) =>
      email ? s.byEmail.get(email.toLowerCase()) : undefined,
    photoUrl:
      (s) =>
      (user?: IFlipUser) =>
        (user?.id && s.pics.get(user.id)?.url) || "",
    allFlipUsers: (s) => Array.from(s.byId.values()),
    
    // Check if a FlipUser is a Teamleiter based on their groups
    isTeamleiter: () => (user?: IFlipUser) => {
      if (!user?.groups || !Array.isArray(user.groups)) return false;
      return user.groups.some(group => 
        TEAMLEITER_GROUP_IDS.includes(group.id)
      );
    },
  },

  actions: {
    /* =======================
     * Flip Users - Collection
     * ======================= */
    async fetchAll(force = false) {
      if (this.loaded && !force) return;
      if (this.loading) return;

      this.loading = true;
      this.error = null;
      try {
        // Use IndexedDB cache via dataCache
        const dataCache = useDataCache();
        const arr = await dataCache.loadFlipUsers(force);
        
        this.byId.clear();
        this.byEmail.clear();

        for (const u of arr) {
          const id = u?.id || undefined;
          if (!id) continue;

          // Backend liefert teils english keys – wir akzeptieren beides
          const mapped: IFlipUser = {
            id: u.id,
            external_id: (u as any).external_id ?? null,
            vorname: (u as any).vorname ?? (u as any).first_name ?? null,
            nachname: (u as any).nachname ?? (u as any).last_name ?? null,
            email: u.email ?? null,
            status: u.status ?? "ACTIVE",
            benutzername: (u as any).benutzername ?? (u as any).username ?? null,
            erstellungsdatum: (u as any).erstellungsdatum ?? (u as any).created_at ?? null,
            aktualisierungsdatum: (u as any).aktualisierungsdatum ?? (u as any).updated_at ?? null,
            loeschdatum: (u as any).loeschdatum ?? (u as any).deletion_at ?? null,
            profilbild: (u as any).profilbild ?? (u as any).profile_picture?.file_id ?? null,
            rolle: (u as any).rolle ?? (u as any).role ?? "USER",
            required_actions: (u as any).required_actions ?? [],
            profile: u.profile ?? (u as any).profile ?? null,
            attributes: Array.isArray((u as any).attributes) ? (u as any).attributes : null,
            primary_user_group: (u as any).primary_user_group
              ? {
                  id: (u as any).primary_user_group.id ?? null,
                  title: (u as any).primary_user_group.title ?? null,
                  language: (u as any).primary_user_group.language ?? null,
                  status: (u as any).primary_user_group.status ?? null,
                }
              : undefined,
            groups: (u as any).groups,
          };

          this.byId.set(id, mapped);
          if (mapped.email) this.byEmail.set(mapped.email.toLowerCase(), mapped);
        }

        this.loaded = true;
      } catch (e: any) {
        this.error = e?.message || "Flip-Users konnten nicht geladen werden.";
      } finally {
        this.loading = false;
      }
    },

    /* =======================
     * Flip User - Einzel
     * ======================= */
    async fetchFlipById(id: string) {
      const data = await fetchFlipUserById(id);
      // wir überschreiben/vereinheitlichen minimal:
      const u = (data?.data ?? data) as any;
      if (!u?.id) return null;
      // Bestehende Groups aus Store bewahren (Einzel-Fetch liefert keine Groups)
      const existing = this.byId.get(u.id);
      const mapped: IFlipUser = {
        id: u.id,
        external_id: u.external_id ?? null,
        vorname: u.first_name ?? u.vorname ?? null,
        nachname: u.last_name ?? u.nachname ?? null,
        email: u.email ?? null,
        status: u.status ?? "ACTIVE",
        benutzername: u.username ?? u.benutzername ?? null,
        erstellungsdatum: u.created_at ?? null,
        aktualisierungsdatum: u.updated_at ?? null,
        loeschdatum: u.deletion_at ?? null,
        profilbild: u.profile_picture?.file_id ?? null,
        rolle: u.role ?? "USER",
        required_actions: u.required_actions ?? [],
        profile: u.profile ?? null,
        attributes: Array.isArray(u.attributes) ? u.attributes : null,
        primary_user_group: u.primary_user_group
          ? {
              id: u.primary_user_group.id ?? null,
              title: u.primary_user_group.title?.text ?? null,
              language: u.primary_user_group.title?.language ?? null,
              status: u.primary_user_group.status ?? null,
            }
          : undefined,
        groups: u.groups ?? existing?.groups ?? [],
      };
      this.byId.set(mapped.id!, mapped);
      if (mapped.email) this.byEmail.set(mapped.email.toLowerCase(), mapped);
      return mapped;
    },

    async updateFlipUser(id: string, payload: Partial<IFlipUser>) {
      const res = await patchFlipUser(id, payload);
      // optional: anschl. fetchFlipById(id) um state zu syncen
      await this.fetchFlipById(id);
      return res;
    },

    /* =======================
     * Mitarbeiter
     * ======================= */
    async fetchMitarbeiters(params?: MitarbeiterFilters) {
      this.mitarbeiterLoading = true;
      this.mitarbeiterError = null;
      try {
        const list = await fetchMitarbeiters(params);
        this.mitarbeiters = list;
        this.mitarbeiterLoaded = true;
      } catch (e: any) {
        this.mitarbeiterError = e?.message || "Fehler beim Laden der Mitarbeiter.";
      } finally {
        this.mitarbeiterLoading = false;
      }
    },

    async patchMitarbeiter(id: string, update: Partial<IMitarbeiter>) {
      const doc = await patchMitarbeiter(id, update);
      // local ersetzen
      const idx = this.mitarbeiters.findIndex((m) => m._id === id);
      if (idx >= 0) this.mitarbeiters[idx] = doc;
      return doc;
    },

    async deleteMitarbeiterMany(ids: string[]) {
      const res = await deleteMitarbeiterMany(ids);
      // lokal auslisten
      this.mitarbeiters = this.mitarbeiters.filter((m) => !ids.includes(m._id));
      return res;
    },

    /* =======================
     * Flip UserGroups
     * ======================= */
    async listUserGroups(params?: Record<string, any>): Promise<IFlipUserGroup[]> {
      return getFlipUserGroups(params);
    },
    async assignUserGroups(payload: { items: Array<{ user_id: string; user_group_id: string }> }) {
      return assignFlipUserGroups(payload);
    },

    /* =======================
     * Flip Tasks / Assignments
     * ======================= */
    async createFlipTask(reqBody: any) {
      return assignFlipTask(reqBody);
    },
    async listFlipAssignments() {
      return getFlipAssignments();
    },
    async listTaskAssignments(taskId: string) {
      return getFlipTaskAssignments(taskId);
    },
    async completeAssignment(id: string) {
      return completeFlipAssignment(id);
    },
    async fetchFlipTasks(userId: string) {
      const { fetchFlipTasks } = await import("../utils/flipApi");
      return fetchFlipTasks(userId);
    },

    /* =======================
     * Routines & Diagnostics
     * ======================= */
    async runInitialRoutine() {
      return runInitialRoutine();
    },
    async runAsanaRoutine() {
      return runAsanaRoutine();
    },
    async getMissingAsanaRefs() {
      return getMissingAsanaRefs();
    },
    async listDuplicateFlipId() {
      return listDuplicateFlipId();
    },
    async listDuplicateAsanaId() {
      return listDuplicateAsanaId();
    },
    async listDuplicateEmail() {
      return listDuplicateEmail();
    },
    async listUsernameEmailDifferences() {
      return listUsernameEmailDifferences();
    },

    /* =======================
     * Profilfoto (Blob Cache)
     * ======================= */
    async ensurePhoto(userOrId?: IFlipUser | string): Promise<string> {
      if (!this.enablePhotos) return "";

      const id = typeof userOrId === "string" ? userOrId : userOrId?.id;
      if (!id) return "";

      const now = Date.now();
      const entry = this.pics.get(id);

      // Bereits im Cache und frisch → direkt zurück
      if (entry?.ts && now - entry.ts < this.picTTL) {
        if (entry.url) return entry.url;
        // Laufendes Promise → darauf warten (kein doppelter Fetch)
        if (entry.promise) return entry.promise;
        // Frisch, aber kein Bild → "" (kein erneuter Versuch innerhalb TTL)
        return "";
      }

      const promise = (async () => {
        try {
          const blob = await fetchFlipProfilePicture(id);
          if (!blob || blob.size === 0) {
            this.pics.set(id, { ts: Date.now() });
            return "";
          }
          // Altes Blob cleanup
          const old = this.pics.get(id);
          if (old?.url) URL.revokeObjectURL(old.url);

          const url = URL.createObjectURL(blob);
          this.pics.set(id, { url, ts: Date.now() });
          return url;
        } catch {
          this.pics.set(id, { ts: Date.now() });
          return "";
        }
      })();

      // Promise im Cache speichern, damit parallele Aufrufe darauf warten
      this.pics.set(id, { promise, ts: now });
      return promise;
    },

    clearPhotos() {
      for (const e of this.pics.values()) {
        if (e.url) URL.revokeObjectURL(e.url);
      }
      this.pics.clear();
    },
  },
});
