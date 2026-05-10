import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Manifest, Section } from '@/types/content'

export function useManifest() {
  return useQuery<Manifest>({
    queryKey: ['manifest'],
    queryFn: () => api.manifest() as unknown as Promise<Manifest>,
  })
}

export function useSection(sectionId: string | null) {
  return useQuery<Section>({
    queryKey: ['section', sectionId],
    queryFn: () => api.section(sectionId!) as unknown as Promise<Section>,
    enabled: sectionId !== null,
  })
}
