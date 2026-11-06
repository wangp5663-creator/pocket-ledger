import { lastNMonths } from './dates';
import { mealMonthSummary } from './meal';
import { planningMonthSummary } from './planning';
import type { MealMonthSummary, MealState } from './meal';
import type { PlanningMonthSummary, PlanningState } from './planning';

export function mealMonthlySeries(state: MealState, today: string, count = 6): MealMonthSummary[] {
  return lastNMonths(today, count).map((month) => mealMonthSummary(state, month, today));
}

export function planningMonthlySeries(
  state: PlanningState,
  today: string,
  count = 6,
): PlanningMonthSummary[] {
  return lastNMonths(today, count).map((month) => planningMonthSummary(state, month, today));
}
