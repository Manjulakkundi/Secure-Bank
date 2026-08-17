import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global reset
const style = document.createElement('style');
style.innerHTML = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #f5f7fa; color: #222; }
  a { text-decoration: none; }
  button:disabled { opacity: 0.6; cursor: not-allowed !important; }
  input:focus, select:focus { border-color: #2E7D9A !important; }
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
