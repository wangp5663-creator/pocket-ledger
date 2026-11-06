import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { MealProvider } from './state/MealStore';
import { PlanningProvider } from './state/PlanningStore';
import './ui/styles.css';

registerSW({
  immediate: true,
  onNeedReload: () => {
    // 新版本在下次打开应用时生效，避免刷新丢失尚未提交的表单输入。
  },
  onRegisterError: (error) => {
    console.warn('Service worker registration failed', error);
  },
});

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
