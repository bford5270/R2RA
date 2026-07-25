import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useExercise } from '../lib/exercise'

export function ExerciseGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { exercise } = useExercise()

  // Admins browse freely. Pending (unapproved) users skip the gate too —
  // they can't access exercises or assessments at all, so forcing them
  // through exercise selection would dead-end (the exercises API 403s).
  const exempt = user?.global_role === 'admin' || user?.global_role === 'pending'

  if (!exempt && !exercise) {
    return <Navigate to="/exercise-select" replace />
  }

  return <>{children}</>
}
