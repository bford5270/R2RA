import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PreviewPage } from './pages/PreviewPage'

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
  return (
    <>
      <BannerTop />
      <BannerBottom />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/preview" element={<PreviewPage />} />
      </Routes>
    </>
  )
}
