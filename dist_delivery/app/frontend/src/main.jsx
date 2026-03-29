import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import VisiteurPage from './VisiteurPage.jsx'

async function bootstrap() {
  const sentryDsn = (import.meta.env.VITE_SENTRY_DSN || '').trim()
  const sentryEnabled = String(import.meta.env.VITE_SENTRY_ENABLED || 'false').toLowerCase() === 'true'

  if (sentryEnabled && sentryDsn) {
    try {
      const Sentry = await import('@sentry/react')
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.VITE_APP_ENV || 'development',
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
        release: import.meta.env.VITE_APP_VERSION || undefined,
      })
    } catch (error) {
      // Non-blocking: the app must still start if telemetry is unavailable.
      console.warn('Sentry initialization failed', error)
    }
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {window.location.pathname && window.location.pathname.startsWith('/visiteur') ? (
        <VisiteurPage />
      ) : (
        <App />
      )}
    </StrictMode>,
  )
}

bootstrap()
