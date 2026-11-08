import {
  addDays,
  addMonths,
  daysInMonth,
  isValidDateKey,
  listDates,
  monthOf,
  todayKey,
} from './dates';
import { createId } from './id';
import { formatYuan } from './money';

export type MealMode = 'normal' | 'minimum';

export interface MealSettingsV2 {
  monthlyBudget: number;
  monthlyMinimum: number;
  startDate: string;
  cycleStartDay?: number;
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
  cycleStartDay?: number;
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
    settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '', cycleStartDay: 1 },
    records: {},
    restores: [],
  };
}

export function deriveRates(
  settings: MealSettingsV2,
  date: string = settings.startDate || todayKey(),
): DerivedRates {
  const days = daysInMonth(monthOf(date));
  const dailyNormal = Math.round(settings.monthlyBudget / days);
  const dailyMinimum = Math.round(settings.monthlyMinimum / days);
  return {
    dailyNormal,
    dailyMinimum,
    freeAllowance: Math.max(0, (dailyNormal - dailyMinimum) * days),
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
  if (!settings.startDate) return '请选择开始日期';
  if (
    settings.cycleStartDay !== undefined &&
    (!Number.isInteger(settings.cycleStartDay) || settings.cycleStartDay < 1 || settings.cycleStartDay > 31)
  ) {
    return '周期起始日必须是 1-31';
  }
  return null;
}

export function createRestoreEvent(
  settings: MealSettingsV2,
  date: string,
  at: string,
  openingBalance = 0,
): RestoreEvent {
  const rates = deriveRates(settings, date);
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
    cycleStartDay: settings.cycleStartDay ?? 1,
  };
}

export function cycleStartKey(month: string, cycleStartDay = 1): string {
  const maxDay = daysInMonth(month);
  const day = Math.min(Math.max(Math.round(cycleStartDay), 1), maxDay);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function nextCycleStartAfter(dateKey: string, cycleStartDay = 1): string {
  const currentMonth = monthOf(dateKey);
  let candidate = cycleStartKey(currentMonth, cycleStartDay);
  if (candidate <= dateKey) {
    candidate = cycleStartKey(addMonths(currentMonth, 1), cycleStartDay);
  }
  return candidate;
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
  freeAllowance: number;
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
    const cycleStartDay = restore.cycleStartDay ?? state.settings.cycleStartDay ?? 1;
    const plannedEndDate = next
      ? addDays(next.date, -1)
      : addDays(nextCycleStartAfter(restore.date, cycleStartDay), -1);
    const endDate = plannedEndDate >= startDate ? plannedEndDate : today;
    if (!endDate || endDate < startDate) continue;

    const periodDays = listDates(startDate, endDate).length;
    const periodFree = Math.max(0, (restore.dailyNormal - restore.dailyMinimum) * periodDays);

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
      if (mode === 'normal' && balance <= -periodFree) {
        switchedToMinimum = true;
        mode = 'minimum';
        switchDate = date;
        balance += periodFree;
        totalAllowance += periodFree;
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
      freeAllowance: periodFree,
    });
    previousEnd = Math.max(0, endingBalance);
  }

  return periods;
}

export function currentMealStatus(state: MealStateV2, today: string): MealStatus {
  const periods = buildMealTimeline(state, today);
  const currentPeriods = periods.filter((period) => period.startDate <= today);
  const period = currentPeriods[currentPeriods.length - 1];
  if (!period) {
    const rates = deriveRates(state.settings, state.settings.startDate || today);
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
      ? Math.max(0, period.freeAllowance - Math.max(0, -balance))
      : 0,
    distanceToMinimum: mode === 'normal' ? period.freeAllowance + balance : 0,
    freeAllowance: period.freeAllowance,
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

  const cycleStartDay = state.settings.cycleStartDay ?? 1;
  const lastDate = restores[restores.length - 1].date;
  let cursor = nextCycleStartAfter(lastDate, cycleStartDay);
  while (cursor <= today) {
    if (!restores.some((event) => event.date === cursor)) {
      const carryPeriods = buildMealTimeline(
        { ...state, restores: [...restores] },
        addDays(cursor, -1),
      );
      const openingBalance = Math.max(0, carryPeriods[carryPeriods.length - 1]?.endingBalance ?? 0);
      restores.push(createRestoreEvent(state.settings, cursor, `${cursor}T00:00:00`, openingBalance));
    }
    cursor = nextCycleStartAfter(cursor, cycleStartDay);
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
  const carryPeriods = buildMealTimeline(normalized, addDays(today, -1));
  const openingBalance = Math.max(0, carryPeriods[carryPeriods.length - 1]?.endingBalance ?? 0);
  const event = createRestoreEvent(normalized.settings, today, new Date().toISOString(), openingBalance);
  const restores = [...normalized.restores, event].sort((a, b) => a.date.localeCompare(b.date));
  return { state: { ...normalized, restores } };
}

export function customizePeriod(
  state: MealStateV2,
  today: string,
  startDate: string,
  endDate: string,
): RestoreResult {
  const normalized = normalizeMealState(state, today);
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
    return { state: normalized, error: '请选择有效日期' };
  }
  if (startDate > endDate) {
    return { state: normalized, error: '开始日期不能晚于结束日期' };
  }

  const nextStartDate =
    startDate < normalized.settings.startDate ? startDate : normalized.settings.startDate;
  const restores = [...normalized.restores].sort((a, b) => a.date.localeCompare(b.date));
  if (restores.length === 0) {
    return { state: normalized, error: '还没有周期' };
  }

  const anchor = [...restores].reverse().find((event) => event.date <= startDate) ?? restores[0];
  const periodSettings: MealSettingsV2 = {
    monthlyBudget: anchor.monthlyBudget,
    monthlyMinimum: anchor.monthlyMinimum,
    startDate: nextStartDate,
    cycleStartDay: anchor.cycleStartDay ?? normalized.settings.cycleStartDay ?? 1,
  };

  const now = new Date().toISOString();
  const nextStart = addDays(endDate, 1);
  const kept = restores.filter((event) => event.date < startDate || event.date > endDate);
  const nextExists = restores.some((event) => event.date === nextStart);
  const nextRestores = [
    ...kept,
    createRestoreEvent(periodSettings, startDate, now),
    ...(nextExists ? [] : [createRestoreEvent(periodSettings, nextStart, now)]),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    state: {
      ...normalized,
      settings: { ...normalized.settings, startDate: nextStartDate },
      restores: nextRestores,
    },
  };
}

export type MealDeficitHint =
  | { kind: 'none' }
  | { kind: 'ended'; over: number }
  | { kind: 'impossible'; over: number; remainingOver: number }
  | { kind: 'lessThanOne'; over: number; days: number }
  | { kind: 'reduce'; over: number; days: number; perDayYuan: number };

export function mealDeficitHint(status: MealStatus, today: string): MealDeficitHint {
  if (status.balance >= 0) return { kind: 'none' };
  const over = -status.balance;
  const start = status.hasRecordToday ? addDays(today, 1) : today;
  const days = status.endDate >= start ? listDates(start, status.endDate).length : 0;
  if (days === 0) return { kind: 'ended', over };
  const perDay = over / days;
  if (perDay > status.dailyAllowance) {
    return { kind: 'impossible', over, remainingOver: over - days * status.dailyAllowance };
  }
  if (perDay < 100) return { kind: 'lessThanOne', over, days };
  return { kind: 'reduce', over, days, perDayYuan: Math.ceil(perDay / 100) };
}

export function formatMealDeficitHint(hint: MealDeficitHint): string | null {
  switch (hint.kind) {
    case 'none':
      return null;
    case 'ended':
      return `本周期已结束，超支 ${formatYuan(hint.over)} 不会结转`;
    case 'impossible':
      return `即使每天不花，本周期仍将超支 ${formatYuan(hint.remainingOver)}`;
    case 'lessThanOne':
      return `超支 ${formatYuan(hint.over)}，剩 ${hint.days} 天，每天额度平均需减少不足 1 元`;
    case 'reduce':
      return `超支 ${formatYuan(hint.over)}，剩 ${hint.days} 天，每天额度至少需减少 ${formatYuan(hint.perDayYuan * 100)}`;
  }
}
