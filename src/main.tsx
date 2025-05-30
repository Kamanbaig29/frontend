import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BotProvider } from './context/BotContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BotProvider>
      <App />
    </BotProvider>
  </StrictMode>,
)
