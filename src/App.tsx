import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMeal } from './state/MealStore';
import { usePlan } from './state/PlanStore';
import { usePlanning } from './state/PlanningStore';
import { Onboarding } from './ui/pages/Onboarding';
import { MealPage } from './ui/pages/MealPage';
import { BackfillPage } from './ui/pages/BackfillPage';
import { PlanningPage } from './ui/pages/PlanningPage';
import { EventDetailPage } from './ui/pages/EventDetailPage';
import { StatsPage } from './ui/pages/StatsPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { CompletedEventsPage } from './ui/pages/CompletedEventsPage';
import { InflowsPage } from './ui/pages/InflowsPage';
import { MealRecordsPage } from './ui/pages/MealRecordsPage';
import { PlansPage } from './ui/pages/PlansPage';

const NAV_ITEMS: Array<{ to: string; label: string; icon: ReactNode }> = [
  {
    to: '/',
    label: '餐补',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12h16a8 8 0 0 1-16 0Z" />
        <path d="M8 8c0-2 1.5-3 3.5-3" />
      </svg>
    ),
  },
  {
    to: '/planning',
    label: '补回账',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 9h7M9 13h7M9 17h4" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: '统计',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
    ),
  },
];

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="bottom-nav__inner">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function StorageBanner() {
  const meal = useMeal();
  const planning = usePlanning();
  const plan = usePlan();
  const message = meal.storageError ?? planning.storageError ?? plan.storageError;
  if (!message) return null;
  return (
    <div className="storage-banner" role="alert">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          meal.dismissError();
          planning.dismissError();
          plan.dismissError();
        }}
      >
        知道了
      </button>
    </div>
  );
}

export default function App() {
  const { state } = useMeal();
  if (!state.settings.startDate) return <Onboarding />;
  return (
    <div className="app-shell">
      <StorageBanner />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MealPage />} />
          <Route path="/meal/backfill" element={<BackfillPage />} />
          <Route path="/meal/records" element={<MealRecordsPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/planning/events/:eventId" element={<EventDetailPage />} />
          <Route path="/planning/completed" element={<CompletedEventsPage />} />
          <Route path="/planning/inflows" element={<InflowsPage />} />
          <Route path="/planning/plans" element={<PlansPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
