/**
 * App: multi-page routing with AppLayout.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProductTour } from '@/components/ProductTour'
import { LandingPage } from '@/pages/LandingPage'
import { UploadPage } from '@/pages/UploadPage'
import { PreviewPage } from '@/pages/PreviewPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { ResultsPage } from '@/pages/ResultsPage'
import { BatchPage } from '@/pages/BatchPage'
import { BatchResultsPage } from '@/pages/BatchResultsPage'
import { MergePage } from '@/pages/MergePage'
import { MergeResultsPage } from '@/pages/MergeResultsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentationPage } from '@/pages/DocumentationPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
          <Route path="upload/:mode" element={<ErrorBoundary><UploadPage /></ErrorBoundary>} />
          <Route path="preview" element={<ErrorBoundary><PreviewPage /></ErrorBoundary>} />
          <Route path="pipeline" element={<ErrorBoundary><PipelinePage /></ErrorBoundary>} />
          <Route path="results" element={<ErrorBoundary><ResultsPage /></ErrorBoundary>} />
          <Route path="batch" element={<ErrorBoundary><BatchPage /></ErrorBoundary>} />
          <Route path="batch/results" element={<ErrorBoundary><BatchResultsPage /></ErrorBoundary>} />
          <Route path="merge" element={<ErrorBoundary><MergePage /></ErrorBoundary>} />
          <Route path="merge/results" element={<ErrorBoundary><MergeResultsPage /></ErrorBoundary>} />
          <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
          <Route path="docs" element={<ErrorBoundary><DocumentationPage /></ErrorBoundary>} />
          <Route path="settings/profile" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ProductTour />
    </>
  )
}

export default App
