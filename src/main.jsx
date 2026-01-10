import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Error handling for root render
try {
  const rootElement = document.getElementById('root')
  
  if (!rootElement) {
    throw new Error('Root element not found. Make sure index.html has <div id="root"></div>')
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('❌ Failed to render application:', error)
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; color: red;">
      <h1>Application Failed to Load</h1>
      <p>Error: ${error.message}</p>
      <p>Check the browser console for more details.</p>
    </div>
  `
}
