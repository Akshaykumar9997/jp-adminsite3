import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { FeedbackProvider, NavigationGuard } from './components/Feedback'
import { UploadProvider } from './components/UploadManager'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './styles.css'
import './cms.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider
      router={createBrowserRouter([
        {
          path: '*',
          element: (
            <FeedbackProvider>
              <NavigationGuard />
              <AuthProvider>
                <UploadProvider>
                  <App />
                </UploadProvider>
              </AuthProvider>
            </FeedbackProvider>
          ),
        },
      ])}
    />
  </StrictMode>,
)
