import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router';
import './index.css';
import App from './App.tsx';

function RedirectHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect =
      params.get('r') || sessionStorage.getItem('redirect');
    if (redirect) {
      sessionStorage.removeItem('redirect');
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  return children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RedirectHandler>
        <App />
      </RedirectHandler>
    </BrowserRouter>
  </StrictMode>,
);
