import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_V2_STORAGE_KEY } from '../storage/mealV2Storage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealStateV2;
  planning?: PlanningState;
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
  return render(
    <MealProvider>
      <PlanningProvider>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </PlanningProvider>
    </MealProvider>,
  );
}
