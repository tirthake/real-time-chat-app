import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// *** CRITICAL: Ensure NO import statements are here other than React, ReactDOM, App, and index.css ***
// The error [vite]: Rollup failed to resolve import "lucide-react" from "/vercel/path0/src/main.jsx" 
// means a line like: `import { IconName } from 'lucide-react';` must be deleted from this file.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);