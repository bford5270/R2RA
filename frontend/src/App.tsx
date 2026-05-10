import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ExerciseGate } from './components/ExerciseGate'
import { LoginPage } from './pages/LoginPage'
import { ExerciseSelectPage } from './pages/ExerciseSelectPage'
import { HomePage } from './pages/HomePage'
import { PreviewPage } from './pages/PreviewPage'
import { CreateAssessmentPage } from './pages/CreateAssessmentPage'
import { AssessmentPage } from './pages/AssessmentPage'
import { PrintPage } from './pages/PrintPage'
import { TrPage } from './pages/TrPage'
import { TrPrintPage } from './pages/TrPrintPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { AuditPage } from './pages/AuditPage'
import { ReadinessPage } from './pages/ReadinessPage'
import { UnitLibraryPage } from './pages/UnitLibraryPage'
import { ProfilePage } from './pages/ProfilePage'
import { CrosswalkEditorPage } from './pages/CrosswalkEditorPage'
import { MctimsPage } from './pages/MctimsPage'
import { FeedbackPage } from './pages/FeedbackPage'

function BannerTop() {
  return (
    <div
      role="banner"
      aria-label="Classification banner — top"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-cui-bg text-cui-text text-xs font-bold tracking-widest uppercase select-none"
      style={{ height: 'var(--cui-banner-height)' }}
    >
      Controlled Unclassified Information // Basic
    </div>
  )
}

function BannerBottom() {
  return (
    <div
      role="contentinfo"
      aria-label="Classification banner — bottom"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-cui-bg text-cui-text text-xs font-bold tracking-widest uppercase select-none"
      style={{ height: 'var(--cui-banner-height)' }}
    >
      Controlled Unclassified Information // Basic
    </div>
  )
}

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <>
      <BannerTop />
      <BannerBottom />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/exercise-select"
          element={
            <ProtectedRoute>
              <ExerciseSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <HomePage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/preview"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <PreviewPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/new"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <CreateAssessmentPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <AssessmentPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/print"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <PrintPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/tr"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <TrPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/tr/print"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <TrPrintPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <AdminUsersPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/mctims"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <MctimsPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/feedback"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <FeedbackPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/audit"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <AuditPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/readiness"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <ReadinessPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <ProfilePage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/crosswalk"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <CrosswalkEditorPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/units/:uic/library"
          element={
            <ProtectedRoute>
              <ExerciseGate>
                <UnitLibraryPage />
              </ExerciseGate>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
