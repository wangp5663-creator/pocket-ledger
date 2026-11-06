import { addDays, addMonths, listDates, monthOf } from './dates';
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

export interface MealDay {
  date: string;
  spent: number;
  note?: string;
  allowance: number;
  dailyBalance: number;
  balanceAfter: number;
  switchedToMinimum: boolean;
}

export interface MealPeriod {
  restore: RestoreEvent;
  startDate: string;
  endDate: string;
  openingBalance: number;
  endingBalance: number;
  carry: number;
  net: number;
  switchDate?: string;
  days: MealDay[];
  totalSpent: number;
  totalAllowance: number;
}

export interface MealStatus {
  mode: MealMode;
  balance: number;
  dailyAllowance: number;
  freeRemaining: number;
  distanceToMinimum: number;
  freeAllowance: number;
  dailyNormal: number;
  dailyMinimum: number;
  startDate: string;
  endDate: string;
  switchDate?: string;
  hasRecordToday: boolean;
  todayRecord?: MealRecordV2;
}

export function buildMealTimeline(state: MealStateV2, today: string): MealPeriod[] {
  const restores = [...state.restores].sort((a, b) => a.date.localeCompare(b.date));
  if (restores.length === 0) return [];

  const periods: MealPeriod[] = [];
  let previousEnd = 0;

  for (let index = 0; index < restores.length; index += 1) {
    const restore = restores[index];
    const next = restores[index + 1];
    const startDate = restore.date;
    const endDate = next ? addDays(next.date, -1) : today;
    if (!endDate || endDate < startDate) continue;

    let balance = index === 0 ? 0 : previousEnd;
    const openingBalance = balance;
    let mode: MealMode = 'normal';
    let switchDate: string | undefined;
    const days: MealDay[] = [];
    let totalSpent = 0;
    let totalAllowance = 0;

    const dates = Object.keys(state.records)
      .filter((date) => date >= startDate && date <= endDate)
      .sort();

    for (const date of dates) {
      const record = state.records[date];
      const allowance = mode === 'normal' ? restore.dailyNormal : restore.dailyMinimum;
      const dailyBalance = allowance - record.spent;
      balance += dailyBalance;
      totalSpent += record.spent;
      totalAllowance += allowance;

      let switchedToMinimum = false;
      if (mode === 'normal' && balance <= -restore.freeAllowance) {
        switchedToMinimum = true;
        mode = 'minimum';
        switchDate = date;
        balance += restore.freeAllowance;
        totalAllowance += restore.freeAllowance;
      }

      days.push({
        date,
        spent: record.spent,
        note: record.note,
        allowance,
        dailyBalance,
        balanceAfter: balance,
        switchedToMinimum,
      });
    }

    const endingBalance = balance;
    periods.push({
      restore,
      startDate,
      endDate,
      openingBalance,
      endingBalance,
      carry: Math.max(0, endingBalance),
      net: endingBalance - openingBalance,
      switchDate,
      days,
      totalSpent,
      totalAllowance,
    });
    previousEnd = Math.max(0, endingBalance);
  }

  return periods;
}

export function currentMealStatus(state: MealStateV2, today: string): MealStatus {
  const periods = buildMealTimeline(state, today);
  const period = periods[periods.length - 1];
  if (!period) {
    const rates = deriveRates(state.settings);
    return {
      mode: 'normal',
      balance: 0,
      dailyAllowance: rates.dailyNormal,
      freeRemaining: rates.freeAllowance,
      distanceToMinimum: rates.freeAllowance,
      freeAllowance: rates.freeAllowance,
      dailyNormal: rates.dailyNormal,
      dailyMinimum: rates.dailyMinimum,
      startDate: state.settings.startDate,
      endDate: today,
      hasRecordToday: Boolean(state.records[today]),
      todayRecord: state.records[today],
    };
  }

  const mode: MealMode = period.switchDate ? 'minimum' : 'normal';
  const balance = period.endingBalance;
  return {
    mode,
    balance,
    dailyAllowance: mode === 'normal' ? period.restore.dailyNormal : period.restore.dailyMinimum,
    freeRemaining: mode === 'normal'
      ? Math.max(0, period.restore.freeAllowance - Math.max(0, -balance))
      : 0,
    distanceToMinimum: mode === 'normal' ? period.restore.freeAllowance + balance : 0,
    freeAllowance: period.restore.freeAllowance,
    dailyNormal: period.restore.dailyNormal,
    dailyMinimum: period.restore.dailyMinimum,
    startDate: period.startDate,
    endDate: period.endDate,
    switchDate: period.switchDate,
    hasRecordToday: Boolean(state.records[today]),
    todayRecord: state.records[today],
  };
}

export function normalizeMealState(state: MealStateV2, today: string): MealStateV2 {
  if (!state.settings.startDate) return state;

  let restores = [...state.restores].sort((a, b) => a.date.localeCompare(b.date));
  if (restores.length === 0) {
    restores = [
      createRestoreEvent(state.settings, state.settings.startDate, `${state.settings.startDate}T00:00:00`),
    ];
  } else if (restores[0].date > state.settings.startDate) {
    restores.unshift(
      createRestoreEvent(state.settings, state.settings.startDate, `${state.settings.startDate}T00:00:00`),
    );
  }

  const lastDate = restores[restores.length - 1].date;
  let cursor = `${addMonths(monthOf(lastDate), 1)}-01`;
  while (cursor <= today) {
    if (!restores.some((event) => event.date === cursor)) {
      restores.push(createRestoreEvent(state.settings, cursor, `${cursor}T00:00:00`));
    }
    cursor = `${addMonths(monthOf(cursor), 1)}-01`;
  }

  restores.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  restores = restores.filter((event) => {
    if (seen.has(event.date)) return false;
    seen.add(event.date);
    return true;
  });

  return { ...state, restores };
}

export interface RestoreResult {
  state: MealStateV2;
  error?: string;
}

export function restoreMealNow(state: MealStateV2, today: string): RestoreResult {
  const normalized = normalizeMealState(state, today);
  if (normalized.restores.some((event) => event.date === today)) {
    return { state: normalized, error: '今天已经恢复过' };
  }
  const event = createRestoreEvent(normalized.settings, today, new Date().toISOString());
  const restores = [...normalized.restores, event].sort((a, b) => a.date.localeCompare(b.date));
  return { state: { ...normalized, restores } };
}
