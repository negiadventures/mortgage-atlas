import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {/*
      Page views only, and no cookie, which is the whole reason for using this
      rather than something that needs a consent banner in front of it. The
      script is served by Vercel itself and does nothing at all in development.
    */}
    <Analytics />
  </React.StrictMode>,
)
