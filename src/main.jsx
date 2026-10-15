//main.jsx

import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource/geist-sans";
import { HelmetProvider } from "react-helmet-async";
import { SmoothScrollProvider } from "./providers/SmoothScrollProvider";


import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SmoothScrollProvider>
      <HelmetProvider><App /></HelmetProvider>
    </SmoothScrollProvider>
  </StrictMode>,
)
