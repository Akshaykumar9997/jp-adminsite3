import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { ContentPage } from './pages/ContentPage'
import { RoomsGalleryPage } from './pages/RoomsGalleryPage'
import { AuthCallback, RequireAdmin } from './auth/AuthProvider'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<Navigate to="/rooms" replace />} />
          <Route path="works" element={<Navigate to="/rooms" replace />} />
          <Route path="rooms" element={<RoomsGalleryPage />} />
          <Route path="rooms/:roomId" element={<RoomsGalleryPage />} />
          <Route path="media" element={<MediaLibraryPage />} />
          <Route
            path="materials"
            element={<ContentPage key="material" kind="material" />}
          />
          <Route
            path="partners"
            element={<ContentPage key="partner" kind="partner" />}
          />
          <Route
            path="collaborations"
            element={<Navigate to="/partners" replace />}
          />
          <Route path="landing" element={<Navigate to="/rooms" replace />} />
          <Route path="settings" element={<Navigate to="/rooms" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
