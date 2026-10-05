import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/index.css';
import './styles/components.css';
import './features/bloodwork/bloodwork.css';
import './features/supplements/supplements.css';
import './features/habits/habits.css';
import './features/screening/screening.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
