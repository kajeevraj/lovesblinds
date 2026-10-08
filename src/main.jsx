import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// A line page opened directly: start fetching its code now instead of when React first renders it.
if (/^\/products\/[^/]+/.test(window.location.pathname)) import('./linepage.jsx');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
