import { addDays, listDates } from './dates';
import { createId } from './id';

export type MealMode = 'normal' | 'minimum';

export interface MealSettingsV2 {
  monthlyBudget: number;
  monthlyMinimum: number;
  startDate: string;
}

export interface MealRecordV2 {
  spent: number;
  note?: string;
  updatedAt: string;
}

export interface RestoreEvent {
  id: string;
  date: string;
  at: string;
  openingBalance: number;
  monthlyBudget: number;
  monthlyMinimum: number;
  freeAllowance: number;
  dailyNormal: number;
  dailyMinimum: number;
  note?: string;
}

export interface MealStateV2 {
  settings: MealSettingsV2;
  records: Record<string, MealRecordV2>;
  restores: RestoreEvent[];
}

export interface DerivedRates {
  dailyNormal: number;
  dailyMinimum: number;
  freeAllowance: number;
}

export function defaultMealStateV2(): MealStateV2 {
  return {
    settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' },
    records: {},
    restores: [],
  };
}

export function deriveRates(settings: MealSettingsV2): DerivedRates {
  return {
    dailyNormal: Math.round(settings.monthlyBudget / 30),
    dailyMinimum: Math.round(settings.monthlyMinimum / 30),
    freeAllowance: settings.monthlyBudget - settings.monthlyMinimum,
  };
}

export function validateMealSettings(settings: MealSettingsV2): string | null {
  if (!Number.isInteger(settings.monthlyBudget) || settings.monthlyBudget <= 0) {
    return '月度预算必须是大于 0 的金额';
  }
  if (!Number.isInteger(settings.monthlyMinimum) || settings.monthlyMinimum < 0) {
    return '月度保底不能为负数';
  }
  if (settings.monthlyMinimum >= settings.monthlyBudget) {
    return '月度保底必须小于月度预算';
  }
  if (!settings.startDate) return '请选择起始日期';
  return null;
}

export function createRestoreEvent(
  settings: MealSettingsV2,
  date: string,
  at: string,
  openingBalance = 0,
): RestoreEvent {
  const rates = deriveRates(settings);
  return {
    id: createId(),
    date,
    at,
    openingBalance: Math.max(0, openingBalance),
    monthlyBudget: settings.monthlyBudget,
    monthlyMinimum: settings.monthlyMinimum,
    freeAllowance: rates.freeAllowance,
    dailyNormal: rates.dailyNormal,
    dailyMinimum: rates.dailyMinimum,
  };
}

export function missingMealDates(state: MealStateV2, today: string): string[] {
  const { startDate } = state.settings;
  if (!startDate) return [];
  const lastMissing = addDays(today, -1);
  if (startDate > lastMissing) return [];
  return listDates(startDate, lastMissing).filter((date) => !state.records[date]);
}

export function upsertMealRecord(
  state: MealStateV2,
  date: string,
  spent: number,
  note: string,
  updatedAt: string,
): MealStateV2 {
  return {
    ...state,
    records: {
      ...state.records,
      [date]: { spent, note: note.trim() || undefined, updatedAt },
    },
  };
}

export function removeMealRecord(state: MealStateV2, date: string): MealStateV2 {
  const records = { ...state.records };
  delete records[date];
  return { ...state, records };
}
