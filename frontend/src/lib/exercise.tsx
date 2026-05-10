import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Exercise } from '../types/exercise'

interface ExerciseState {
  exercise: Exercise | null
  setExercise: (ex: Exercise | null) => void
  clearExercise: () => void
}

const ExerciseContext = createContext<ExerciseState | null>(null)

export function ExerciseProvider({ children }: { children: ReactNode }) {
  const [exercise, setExerciseState] = useState<Exercise | null>(null)

  const setExercise = useCallback((ex: Exercise | null) => {
    setExerciseState(ex)
  }, [])

  const clearExercise = useCallback(() => {
    setExerciseState(null)
  }, [])

  return (
    <ExerciseContext.Provider value={{ exercise, setExercise, clearExercise }}>
      {children}
    </ExerciseContext.Provider>
  )
}

export function useExercise(): ExerciseState {
  const ctx = useContext(ExerciseContext)
  if (!ctx) throw new Error('useExercise must be used within ExerciseProvider')
  return ctx
}
