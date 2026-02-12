import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PredictionMarket from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PredictionMarket />
  </StrictMode>,
)
