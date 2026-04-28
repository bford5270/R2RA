import type { AuthUser, LoginResponse } from '../types/auth'
import type { Assessment, AssessmentCreate, AuditLogEntry, ItemResponse, ResponseUpsert, SignatureOut, TrResponse, TrResponseUpsert } from '../types/assessment'
import type { ReadinessRow } from '../types/reports'
import type { LibraryItem } from '../types/library'
import type { CrosswalkEntry, CrosswalkEditorFull } from '../types/crosswalk'
import type { TrFramework } from '../types/tr'
import type { EvidenceItem } from '../types/evidence'
import type { UserOut, UserUpdate, AssignmentOut, AssignmentUpsert } from '../types/user'

const BASE = '/api'

// Token is set by AuthContext on login/logout; never touches localStorage.
let _token: string | null = null
export function setToken(t: string | null) {
  _token = t
}

export function authHeaders(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    let detail = `API error ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // ignore parse error
    }
    throw new Error(detail)
  }
  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function get<T>(path: string) {
  return request<T>(path)
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function postForm<T>(path: string, formData: FormData) {
  return request<T>(path, { method: 'POST', body: formData })
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

export const api = {
  // ---- health ----
  health: () => get<{ status: string; app: string; cui_banner: string }>('/health'),

  // ---- content ----
  manifest: () => get<Record<string, unknown>>('/content/jts_r2/manifest'),
  sections: () => get<Array<{ id: string; ordinal: number; file: string }>>('/content/jts_r2/sections'),
  section: (id: string) => get<Record<string, unknown>>(`/content/jts_r2/sections/${id}`),

  // ---- auth ----
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),

  totpComplete: (partial_token: string, code: string) =>
    post<LoginResponse>('/auth/totp/complete', { partial_token, code }),

  me: () => get<AuthUser>('/auth/me'),

  totpEnroll: () => get<{ secret: string; uri: string }>('/auth/totp/enroll'),
  totpConfirm: (secret: string, code: string) =>
    post<void>('/auth/totp/confirm', { secret, code }),
  totpUnenroll: () => del<void>('/auth/totp'),

  register: (display_name: string, email: string, password: string, global_role = 'admin') =>
    post<AuthUser>('/auth/register', { display_name, email, password, global_role }),

  // ---- assessments ----
  createAssessment: (body: AssessmentCreate) =>
    post<Assessment>('/assessments', body),

  listAssessments: () =>
    get<Assessment[]>('/assessments'),

  getAssessment: (id: string) =>
    get<Assessment>(`/assessments/${id}`),

  listResponses: (assessmentId: string) =>
    get<ItemResponse[]>(`/assessments/${assessmentId}/responses`),

  upsertResponse: (assessmentId: string, itemId: string, body: ResponseUpsert) =>
    request<ItemResponse>(`/assessments/${assessmentId}/responses/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  advanceStatus: (assessmentId: string, nextStatus: string) =>
    request<Assessment>(`/assessments/${assessmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    }),

  certify: (assessmentId: string, printName: string, signerRole: string) =>
    request<Assessment>(`/assessments/${assessmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'certified', print_name: printName, signer_role: signerRole }),
    }),

  listSignatures: (assessmentId: string) =>
    get<SignatureOut[]>(`/assessments/${assessmentId}/signatures`),

  getCrosswalk: (sectionId: string) =>
    get<CrosswalkEntry[]>(`/crosswalk/${sectionId}`),

  // ---- T&R framework content ----
  getTrFramework: () =>
    get<TrFramework>('/content/tr'),

  // ---- T&R responses ----
  listTrResponses: (assessmentId: string) =>
    get<TrResponse[]>(`/assessments/${assessmentId}/tr-responses`),

  upsertTrResponse: (assessmentId: string, eventCode: string, body: TrResponseUpsert) =>
    request<TrResponse>(`/assessments/${assessmentId}/tr-responses/${encodeURIComponent(eventCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  // ---- evidence ----
  listEvidence: (assessmentId: string, itemId: string) =>
    get<EvidenceItem[]>(`/assessments/${assessmentId}/responses/${itemId}/evidence`),

  uploadEvidence: (assessmentId: string, itemId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return postForm<EvidenceItem>(`/assessments/${assessmentId}/responses/${itemId}/evidence`, fd)
  },

  deleteEvidence: (assessmentId: string, itemId: string, evidenceId: string) =>
    del<void>(`/assessments/${assessmentId}/responses/${itemId}/evidence/${evidenceId}`),

  evidenceFileUrl: (evidenceId: string) => `/api/evidence/${evidenceId}/file`,

  // ---- users ----
  listUsers: (all = false) =>
    get<UserOut[]>(`/users${all ? '?all=true' : ''}`),

  updateUser: (userId: string, body: UserUpdate) =>
    request<UserOut>(`/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  createUser: (display_name: string, email: string, password: string, global_role: string) =>
    post<UserOut>('/users', { display_name, email, password, global_role }),

  // ---- assignments ----
  listAssignments: (assessmentId: string) =>
    get<AssignmentOut[]>(`/assessments/${assessmentId}/assignments`),

  upsertAssignment: (assessmentId: string, userId: string, body: AssignmentUpsert) =>
    request<AssignmentOut>(`/assessments/${assessmentId}/assignments/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  deleteAssignment: (assessmentId: string, assignmentId: string) =>
    del<void>(`/assessments/${assessmentId}/assignments/${assignmentId}`),

  // ---- audit log ----
  listAuditLog: (assessmentId: string) =>
    get<AuditLogEntry[]>(`/assessments/${assessmentId}/audit`),

  // ---- reports ----
  readinessReport: () =>
    get<ReadinessRow[]>('/reports/readiness'),

  // ---- profile / security ----
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),

  // ---- crosswalk editor (admin only) ----
  crosswalkEditorFull: () =>
    get<CrosswalkEditorFull>('/crosswalk-editor/full'),

  crosswalkEditorStatus: () =>
    get<{ status: string }>('/crosswalk-editor/status'),

  crosswalkEditorSetStatus: (status: string) =>
    request<{ status: string }>('/crosswalk-editor/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),

  crosswalkEditorSave: (jtsItem: string, body: { wickets: unknown[]; mets: unknown[]; note: string }) =>
    request<CrosswalkEntry>(`/crosswalk-editor/${encodeURIComponent(jtsItem)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  crosswalkEditorRevert: (jtsItem: string) =>
    del<{ jts_item: string; reverted: boolean }>(`/crosswalk-editor/${encodeURIComponent(jtsItem)}`),

  crosswalkEditorExportUrl: () => `${BASE}/crosswalk-editor/export.yaml`,

  // ---- unit library ----
  listLibrary: (uic: string) =>
    get<LibraryItem[]>(`/units/${encodeURIComponent(uic)}/library`),

  uploadLibraryItem: (uic: string, file: File, label: string, category: string, description: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('label', label)
    fd.append('category', category)
    fd.append('description', description)
    return postForm<LibraryItem>(`/units/${encodeURIComponent(uic)}/library`, fd)
  },

  deleteLibraryItem: (uic: string, itemId: string) =>
    del<void>(`/units/${encodeURIComponent(uic)}/library/${itemId}`),

  libraryFileUrl: (uic: string, itemId: string) =>
    `/api/units/${encodeURIComponent(uic)}/library/${itemId}/file`,
}
