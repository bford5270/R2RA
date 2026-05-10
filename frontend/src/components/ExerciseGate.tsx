import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useExercise } from '../lib/exercise'

export function ExerciseGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { exercise } = useExercise()

  if (user?.global_role !== 'admin' && !exercise) {
    return <Navigate to="/exercise-select" replace />
  }

  return <>{children}</>
}
