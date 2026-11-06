import { addDays, listDates, monthEndKey, monthOf } from './dates';

export interface MealRecord {
  spent: number;
  note?: string;
  allowance: number;
  updatedAt: string;
}

export interface MealSettings {
  dailyAllowance: number;
  startDate: string;
}

export interface MealState {
  settings: MealSettings;
  records: Record<string, MealRecord>;
}

export function defaultMealState(): MealState {
  return { settings: { dailyAllowance: 2000, startDate: '' }, records: {} };
}

export function dailyBalance(record: MealRecord): number {
  return record.allowance - record.spent;
}

export function computeMealBalance(state: MealState): number {
  const { startDate } = state.settings;
  return Object.entries(state.records)
    .filter(([date]) => date >= startDate)
    .reduce((total, [, record]) => total + dailyBalance(record), 0);
}

export function missingDates(state: MealState, today: string): string[] {
  const { startDate } = state.settings;
  if (!startDate) return [];
  const lastMissing = addDays(today, -1);
  if (startDate > lastMissing) return [];
  return listDates(startDate, lastMissing).filter((date) => !state.records[date]);
}

export interface MealRow {
  date: string;
  record: MealRecord;
  daily: number;
  cumulative: number;
}

export function buildMealRows(state: MealState): MealRow[] {
  let cumulative = 0;
  return Object.keys(state.records)
    .filter((date) => date >= state.settings.startDate)
    .sort()
    .map((date) => {
      const record = state.records[date];
      const daily = dailyBalance(record);
      cumulative += daily;
      return { date, record, daily, cumulative };
    });
}

export interface MealMonthSummary {
  month: string;
  daysRecorded: number;
  allowanceTotal: number;
  spentTotal: number;
  net: number;
  endBalance: number;
}

export function mealMonthSummary(state: MealState, month: string, today: string): MealMonthSummary {
  const endDate = month >= monthOf(today) ? today : monthEndKey(month);
  const monthRecords = Object.entries(state.records)
    .filter(([date]) => date >= state.settings.startDate && monthOf(date) === month)
    .map(([, record]) => record);
  const allowanceTotal = monthRecords.reduce((total, record) => total + record.allowance, 0);
  const spentTotal = monthRecords.reduce((total, record) => total + record.spent, 0);
  const endBalance = Object.entries(state.records)
    .filter(([date]) => date >= state.settings.startDate && date <= endDate)
    .reduce((total, [, record]) => total + dailyBalance(record), 0);
  return {
    month,
    daysRecorded: monthRecords.length,
    allowanceTotal,
    spentTotal,
    net: allowanceTotal - spentTotal,
    endBalance,
  };
}
