// src/services/flipApi.ts
import api from "./api";
import type {
  IFlipUser,
  IMitarbeiter,
  ILaufzettel,
  IEventReport,
  IEvaluierungMA,
  IFlipTask,
  IFlipUserGroup,
  MitarbeiterFilters,
  UUID,
} from "../types/flip";

type ApiList<T> = { success?: boolean; data?: T[] } | T[];

/* =============
 * Flip / Users
 * ============= */

export async function fetchFlipUsers(params?: Record<string, any>): Promise<IFlipUser[]> {
  const { data } = await api.get<ApiList<IFlipUser>>("/api/personal/flip", { params });
  return Array.isArray(data) ? data : data?.data || [];
}

export async function fetchFlipUserById(id: UUID) {
  const { data } = await api.get(`/api/personal/flip/by-id/${id}`);
  return data;
}

export async function patchFlipUser(id: UUID, payload: Partial<IFlipUser>) {
  const { data } = await api.patch(`/api/personal/flip/user/${id}`, payload);
  return data;
}

export async function getFlipUserGroups(params?: Record<string, any>): Promise<IFlipUserGroup[]> {
  const { data } = await api.get<ApiList<IFlipUserGroup>>("/api/personal/user-groups", { params });
  return Array.isArray(data) ? data : data?.data || [];
}

export async function assignFlipUserGroups(payload: {
  items: Array<{ user_id: UUID; user_group_id: UUID }>;
}) {
  const { data } = await api.post("/api/personal/user-groups-assign", payload);
  return data;
}

/* ==========
 * Aufgaben
 * ========== */

export async function assignFlipTask(reqBody: any) {
  const { data } = await api.post("/api/personal/assignTask", reqBody);
  return data;
}

export async function getFlipTaskAssignments(taskId: UUID) {
  const { data } = await api.get(`/api/personal/task/assignments/${taskId}`);
  return data?.data ?? data;
}

export async function getFlipAssignments() {
  const { data } = await api.get("/api/personal/task/assignments");
  return data?.data ?? data;
}

export async function completeFlipAssignment(id: UUID) {
  const { data } = await api.post(`/api/personal/task/assignments/${id}/complete`);
  return data?.data ?? data;
}

export async function fetchFlipTasks(userId: UUID): Promise<IFlipTask[]> {
  const { data } = await api.get(`/api/personal/flip/tasks/${userId}`);
  return Array.isArray(data) ? data : data?.data || [];
}

/* ==================
 * Mitarbeiter (DB)
 * ================== */

export async function fetchMitarbeiters(filters?: MitarbeiterFilters): Promise<IMitarbeiter[]> {
  const { data } = await api.get("/api/personal/mitarbeiter", { params: filters });
  return data?.data || [];
}

export async function patchMitarbeiter(id: string, update: Partial<IMitarbeiter>): Promise<IMitarbeiter> {
  const { data } = await api.patch(`/api/personal/mitarbeiter/${id}`, update);
  return data?.data || data;
}

export async function deleteMitarbeiterMany(ids: string[]) {
  const { data } = await api.delete("/api/personal/mitarbeiter", { data: ids });
  return data;
}

/* ======================
 * Routines & Diagnostics
 * ====================== */

export async function runInitialRoutine() {
  const { data } = await api.get("/api/personal/initialRoutine");
  return data;
}

export async function runAsanaRoutine() {
  const { data } = await api.get("/api/personal/asanaRoutine");
  return data;
}

export async function getMissingAsanaRefs() {
  const { data } = await api.get("/api/personal/missingAsanaRefs");
  return data;
}

export async function listDuplicateFlipId() {
  const { data } = await api.get("/api/personal/duplicates/flip-id");
  return data;
}

export async function listDuplicateAsanaId() {
  const { data } = await api.get("/api/personal/duplicates/asana-id");
  return data;
}

export async function listDuplicateEmail() {
  const { data } = await api.get("/api/personal/duplicates/email");
  return data;
}

export async function listUsernameEmailDifferences() {
  const { data } = await api.get("/api/personal/differences/username/email");
  return data;
}

/* ==================
 * Dokumente (DB)
 * ================== */

export async function sendDocument(
  type: "laufzettel" | "event_report" | "evaluierung",
  body: any
) {
  const { data } = await api.post("/api/reports/send", body, {
    headers: { "document-type": type },
  });
  return data;
}

export async function assignDocument(body: {
  documentId: string;
  teamleiterId?: string;
  mitarbeiterId?: string;
  name_teamleiter?: string;
  name_mitarbeiter?: string;
}) {
  const { data } = await api.post("/api/reports/assign", body);
  return data;
}

/* ==================
 * Utilities
 * ================== */

export async function fetchFlipProfilePicture(fileId: string): Promise<Blob | null> {
  try {
    const res = await api.get(`/api/personal/flip/profilePicture/${fileId}`, {
      responseType: "blob",
    });
    // 204 => kein Bild
    if (res.status === 204) return null;
    return res.data as Blob;
  } catch {
    return null;
  }
}
