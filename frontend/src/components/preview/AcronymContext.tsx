import { createContext, useContext, useRef, type RefObject } from 'react'

const AcronymContext = createContext<RefObject<Set<string>> | null>(null)

export function AcronymProvider({ children }: { children: React.ReactNode }) {
  const seenRef = useRef<Set<string>>(new Set())
  return <AcronymContext.Provider value={seenRef}>{children}</AcronymContext.Provider>
}

export function useSeenAcronyms() {
  return useContext(AcronymContext)
}
