import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '@/context/AppContext'
import { ProfileProvider } from '@/context/ProfileContext'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

