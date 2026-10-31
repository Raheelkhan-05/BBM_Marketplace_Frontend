//main.jsx

import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource/geist-sans";
import { HelmetProvider } from "react-helmet-async";
import { SmoothScrollProvider } from "./providers/SmoothScrollProvider";
import { initAnalytics } from "./lib/analytics.js";


import './index.css'
import App from './App.jsx'

// Starts opted-out; nothing is sent until the user accepts the consent banner.
initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SmoothScrollProvider>
      <HelmetProvider><App /></HelmetProvider>
    </SmoothScrollProvider>
  </StrictMode>,
)