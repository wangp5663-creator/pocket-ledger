import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { MealProvider } from './state/MealStore';
import { PlanningProvider } from './state/PlanningStore';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealProvider>
      <PlanningProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </PlanningProvider>
    </MealProvider>
  </StrictMode>,
);
