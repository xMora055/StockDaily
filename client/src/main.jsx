import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ProveedorAutenticacion } from './contextos/AutenticacionContexto.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProveedorAutenticacion>
      <App />
    </ProveedorAutenticacion>
  </StrictMode>,
)
