import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initBrowserCompatibility, showCompatibilityWarningIfNeeded } from './utils/initBrowserCompat'

// Initialize browser compatibility features
initBrowserCompatibility().then(() => {
  // Show compatibility warning if needed
  showCompatibilityWarningIfNeeded();
  
  // Render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}).catch((error) => {
  console.error('Failed to initialize browser compatibility:', error);
  
  // Still render the app even if compatibility init fails
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});