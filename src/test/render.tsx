import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import type { PlanState } from '../domain/planItems';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanProvider } from '../state/PlanStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_V2_STORAGE_KEY } from '../storage/mealV2Storage';
import { PLAN_ITEMS_STORAGE_KEY } from '../storage/planItemsStorage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealStateV2;
  planning?: PlanningState;
  plan?: PlanState;
}

export function mealFixture(overrides: Partial<MealStateV2> = {}): MealStateV2 {
  const settings = overrides.settings ?? {
    monthlyBudget: 60000,
    monthlyMinimum: 45000,
    startDate: todayKey(),
  };
  const fallbackRestores = settings.startDate
    ? [createRestoreEvent(settings, settings.startDate, `${settings.startDate}T00:00:00`)]
    : [];
  return {
    settings,
    records: overrides.records ?? {},
    restores: overrides.restores ?? fallbackRestores,
  };
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  localStorage.clear();
  if (options.meal) localStorage.setItem(MEAL_V2_STORAGE_KEY, JSON.stringify(options.meal));
  if (options.planning) localStorage.setItem(PLANNING_STORAGE_KEY, JSON.stringify(options.planning));
  if (options.plan) localStorage.setItem(PLAN_ITEMS_STORAGE_KEY, JSON.stringify(options.plan));
  return render(
    <MealProvider>
      <PlanningProvider>
        <PlanProvider>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </PlanProvider>
      </PlanningProvider>
    </MealProvider>,
  );
}
