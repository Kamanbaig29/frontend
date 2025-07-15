import React from 'react'
import ReactDOM from 'react-dom/client'
import {App} from './App'
import './index.css'
// src/main.tsx or src/index.tsx
//import TokenListWithAge from './components/TokenListWIthAge';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    
  </React.StrictMode>,
)
