import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import VisiteurPage from './VisiteurPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname && window.location.pathname.startsWith('/visiteur') ? (
      <VisiteurPage />
    ) : (
      <App />
    )}
  </StrictMode>,
)
