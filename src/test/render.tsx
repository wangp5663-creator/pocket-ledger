import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { MealState } from '../domain/meal';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_STORAGE_KEY } from '../storage/mealStorage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealState;
  planning?: PlanningState;
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  localStorage.clear();
  if (options.meal) localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(options.meal));
  if (options.planning) localStorage.setItem(PLANNING_STORAGE_KEY, JSON.stringify(options.planning));
  return render(
    <MealProvider>
      <PlanningProvider>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </PlanningProvider>
    </MealProvider>,
  );
}
