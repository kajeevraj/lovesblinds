import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// The two fonts are served from our own site (no request to Google Fonts): only the Latin letters, in the weights the site uses.
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import './styles.css';

// A line page opened directly: start fetching its code now instead of when React first renders it.
if (/^\/products\/[^/]+/.test(window.location.pathname)) import('./linepage.jsx');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
