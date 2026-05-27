import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" toastOptions={{ className: 'text-sm' }} />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
