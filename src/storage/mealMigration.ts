import type { MealState } from '../domain/meal';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';

export function migrateMealV1ToV2(v1: MealState): MealStateV2 {
  const dailyAllowance = Number.isInteger(v1.settings.dailyAllowance) && v1.settings.dailyAllowance > 0
    ? v1.settings.dailyAllowance
    : 2000;
  const monthlyBudget = dailyAllowance * 30;
  // The 1500 fallback keeps the free allowance positive for small budgets.
  const monthlyMinimum = monthlyBudget > 45000 ? 45000 : Math.max(0, monthlyBudget - 1500);
  const settings = {
    monthlyBudget,
    monthlyMinimum,
    startDate: v1.settings.startDate,
  };

  const records: MealStateV2['records'] = Object.fromEntries(
    Object.entries(v1.records).map(([date, record]) => [
      date,
      {
        spent: record.spent,
        note: record.note,
        updatedAt: record.updatedAt,
      },
    ]),
  );

  const restores = settings.startDate
    ? [createRestoreEvent(settings, settings.startDate, `${settings.startDate}T00:00:00`)]
    : [];

  return { settings, records, restores };
}
