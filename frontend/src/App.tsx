import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
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
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/preview"
          element={
            <ProtectedRoute>
              <PreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/new"
          element={
            <ProtectedRoute>
              <CreateAssessmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId"
          element={
            <ProtectedRoute>
              <AssessmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/print"
          element={
            <ProtectedRoute>
              <PrintPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/tr"
          element={
            <ProtectedRoute>
              <TrPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/tr/print"
          element={
            <ProtectedRoute>
              <TrPrintPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId/audit"
          element={
            <ProtectedRoute>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/readiness"
          element={
            <ProtectedRoute>
              <ReadinessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/units/:uic/library"
          element={
            <ProtectedRoute>
              <UnitLibraryPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
