import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { markPlatform } from './platform/tauri';
import './styles/app.css';

markPlatform();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
