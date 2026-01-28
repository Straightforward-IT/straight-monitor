// src/stores/flipAll.ts
import { defineStore } from "pinia";
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
    enablePhotos: false, // ❌ Disable loading to prevent 404s/spam logs
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
        const arr = await fetchFlipUsers();
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

      // Prüfe ob bereits im Cache
      const now = Date.now();
      const entry = this.pics.get(id) || {};
      const fresh = entry.ts && now - entry.ts < this.picTTL;

      if (fresh && entry.url) return entry.url;
      if (entry.promise) return entry.promise as Promise<string>;

      // Authentifizierte Anfrage mit Headers
      const promise = (async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return "";

          const response = await fetch(`/api/personal/flip/profilePicture/${id}`, {
            headers: {
              'x-auth-token': token
            }
          });

          console.log(`Profile picture response for ${id}:`, response.status, response.headers.get('content-type'));

          if (!response.ok) {
            if (response.status === 204) {
              // Kein Profilbild verfügbar
              console.log(`No profile picture available for user ${id}`);
              this.pics.set(id, { ts: Date.now() });
              return "";
            }
            console.error(`Failed to fetch profile picture for ${id}: HTTP ${response.status}`);
            
            // Bei HTML-Response (wahrscheinlich Fehlerseite), Inhalt loggen
            if (response.headers.get('content-type')?.includes('text/html')) {
              const errorText = await response.text();
              console.error(`HTML Error response for ${id}:`, errorText.substring(0, 200));
            }
            
            this.pics.set(id, { ts: Date.now() });
            return "";
          }

          // Prüfe Content-Type vor Blob-Erstellung
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.startsWith('image/')) {
            console.error(`Invalid content-type for user ${id}: ${contentType}`);
            
            // Bei HTML-Response, Inhalt loggen für Debugging
            if (contentType.includes('text/html')) {
              const errorText = await response.text();
              console.error(`HTML Response for ${id}:`, errorText.substring(0, 200));
            }
            
            this.pics.set(id, { ts: Date.now() });
            return "";
          }

          const blob = await response.blob();
          console.log(`Profile picture blob for ${id}:`, blob.size, 'bytes, type:', blob.type);
          
          // Validiere Blob bevor URL erstellt wird
          if (blob.size === 0) {
            console.warn(`Empty blob received for user ${id}`);
            this.pics.set(id, { ts: Date.now() });
            return "";
          }
          
          // Versuche Blob-URL
          let url = URL.createObjectURL(blob);
          console.log(`Created blob URL for ${id}:`, url);
          
          // Fallback: Data-URL (funktioniert oft besser)
          // Uncomment this for debugging:
          // const reader = new FileReader();
          // url = await new Promise((resolve) => {
          //   reader.onload = () => resolve(reader.result as string);
          //   reader.readAsDataURL(blob);
          // });
          // console.log(`Created data URL for ${id} (${url.substring(0, 50)}...)`);
          
          // Test ob URL funktioniert
          const img = new Image();
          img.onload = () => console.log(`✅ Image loaded successfully for ${id}`);
          img.onerror = (e) => console.error(`❌ Image failed to load for ${id}:`, e);
          img.src = url;
          
          // Altes Blob cleanup (nur für Blob-URLs)
          if (entry.url && entry.url.startsWith('blob:')) {
            URL.revokeObjectURL(entry.url);
          }
          
          this.pics.set(id, { url, ts: Date.now() });
          return url;
        } catch (error) {
          console.error(`Error loading profile picture for ${id}:`, error);
          this.pics.set(id, { ts: Date.now() });
          return "";
        }
      })();

      this.pics.set(id, { promise, ts: Date.now() });
      return promise;

      /* Alte Implementierung mit File-ID und Blob-Cache:
      const id = typeof userOrId === "string" ? userOrId : userOrId?.id;
      if (!id) return "";

      // wir erwarten fileId == profilbild; Backend-Route nimmt :id == file_id
      const fileId =
        typeof userOrId === "string"
          ? this.byId.get(userOrId)?.profilbild || null
          : userOrId?.profilbild || null;

      if (!fileId) return "";

      const now = Date.now();
      const entry = this.pics.get(id) || {};
      const fresh = entry.ts && now - entry.ts < this.picTTL;

      if (fresh && entry.url) return entry.url;
      if (entry.promise) return entry.promise as Promise<string>;

      const p = (async () => {
        try {
          const blob = await fetchFlipProfilePicture(fileId);
          if (!blob) {
            this.pics.set(id, { ts: Date.now() });
            return "";
          }
          const url = URL.createObjectURL(blob);
          if (entry.url) URL.revokeObjectURL(entry.url);
          this.pics.set(id, { url, ts: Date.now() });
          return url;
        } catch {
          this.pics.set(id, { ts: Date.now() });
          return "";
        } finally {
          const e2 = this.pics.get(id);
          if (e2) delete e2.promise;
        }
      })();

      this.pics.set(id, { ...entry, promise: p });
      return p; */
    },

    clearPhotos() {
      for (const e of this.pics.values()) {
        if (e.url) URL.revokeObjectURL(e.url);
      }
      this.pics.clear();
    },
  },
});
