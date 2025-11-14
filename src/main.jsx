import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// FIX: Explicitly importing lucide-react here ensures the browser resolves 
// its module path correctly at runtime, fixing the final console error.
import 'lucide-react' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)