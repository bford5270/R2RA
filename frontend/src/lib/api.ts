const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<{ status: string; app: string; cui_banner: string }>('/health'),
  manifest: () => get<Record<string, unknown>>('/content/jts_r2/manifest'),
  sections: () => get<Array<{ id: string; ordinal: number; file: string }>>('/content/jts_r2/sections'),
  section: (id: string) => get<Record<string, unknown>>(`/content/jts_r2/sections/${id}`),
}
