import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SettingsPage } from './pages/SettingsPage'
import { RoomsPage } from './pages/RoomsPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { CollaborationsPage } from './pages/CollaborationsPage'
import { LandingPage } from './pages/LandingPage'
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
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="media" element={<MediaLibraryPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="collaborations" element={<CollaborationsPage />} />
          <Route path="landing" element={<LandingPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
