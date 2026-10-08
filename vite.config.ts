import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { serveAdmins } from './server/admins.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const install = (server: {
    middlewares: { use: (path: string, handler: typeof serveAdmins) => void }
  }) => {
    server.middlewares.use('/api/admins', (req, res) =>
      serveAdmins(req, res, env),
    )
  }
  return {
    plugins: [
      react(),
      {
        name: 'admin-management-api',
        configureServer: install,
        configurePreviewServer: install,
      },
    ],
  }
})
