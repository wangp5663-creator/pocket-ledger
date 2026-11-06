import { monthEndKey, monthOf } from './dates';

export interface ReplenishPlanItem {
  month: string;
  amount: number;
}

export interface PlanningEvent {
  id: string;
  name: string;
  plannedTotal?: number;
  note?: string;
  replenishPlan: ReplenishPlanItem[];
  createdAt: string;
}

export interface EntryBase {
  id: string;
  date: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface SpendEntry extends EntryBase {
  eventId: string;
}

export interface ReplenishEntry extends EntryBase {
  eventId: string;
}

export type InflowEntry = EntryBase;

export interface PlanningState {
  events: PlanningEvent[];
  spends: SpendEntry[];
  replenishes: ReplenishEntry[];
  inflows: InflowEntry[];
}

export function emptyPlanningState(): PlanningState {
  return { events: [], spends: [], replenishes: [], inflows: [] };
}

export function sumAmounts(entries: Array<{ amount: number }>): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

export function computePlanningBalance(state: PlanningState): number {
  return sumAmounts(state.inflows) + sumAmounts(state.replenishes) - sumAmounts(state.spends);
}

export interface EventProgress {
  spent: number;
  replenished: number;
  outstanding: number;
  overPlanned?: number;
}

export function eventProgress(state: PlanningState, eventId: string): EventProgress {
  const event = state.events.find((candidate) => candidate.id === eventId);
  const spent = sumAmounts(state.spends.filter((entry) => entry.eventId === eventId));
  const replenished = sumAmounts(state.replenishes.filter((entry) => entry.eventId === eventId));
  const overPlanned =
    event?.plannedTotal !== undefined && spent > event.plannedTotal ? spent - event.plannedTotal : undefined;
  return { spent, replenished, outstanding: spent - replenished, overPlanned };
}

export type TimelineKind = 'spend' | 'replenish';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  amount: number;
  note?: string;
  outstandingAfter: number;
}

export function eventTimeline(state: PlanningState, eventId: string): TimelineItem[] {
  const items = [
    ...state.spends
      .filter((entry) => entry.eventId === eventId)
      .map((entry) => ({ ...entry, kind: 'spend' as const })),
    ...state.replenishes
      .filter((entry) => entry.eventId === eventId)
      .map((entry) => ({ ...entry, kind: 'replenish' as const })),
  ].sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));

  let outstanding = 0;
  return items.map((item) => {
    outstanding += item.kind === 'spend' ? item.amount : -item.amount;
    return {
      id: item.id,
      kind: item.kind,
      date: item.date,
      amount: item.amount,
      note: item.note,
      outstandingAfter: outstanding,
    };
  });
}

export interface PlanComparisonRow {
  month: string;
  planned: number;
  actual: number;
  diff: number;
}

export function replenishPlanComparison(state: PlanningState, eventId: string): PlanComparisonRow[] {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) return [];
  const months = new Set<string>();
  event.replenishPlan.forEach((item) => months.add(item.month));
  state.replenishes
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => months.add(monthOf(entry.date)));
  return [...months].sort().map((month) => {
    const planned = event.replenishPlan
      .filter((item) => item.month === month)
      .reduce((total, item) => total + item.amount, 0);
    const actual = sumAmounts(
      state.replenishes.filter((entry) => entry.eventId === eventId && monthOf(entry.date) === month),
    );
    return { month, planned, actual, diff: actual - planned };
  });
}

export interface PlanningMonthSummary {
  month: string;
  spends: number;
  replenishes: number;
  inflows: number;
  net: number;
  endBalance: number;
}

export function planningBalanceUntil(state: PlanningState, endDate: string): number {
  const until = (entry: { date: string }) => entry.date <= endDate;
  return (
    sumAmounts(state.inflows.filter(until)) +
    sumAmounts(state.replenishes.filter(until)) -
    sumAmounts(state.spends.filter(until))
  );
}

export function planningMonthSummary(state: PlanningState, month: string, today: string): PlanningMonthSummary {
  const inMonth = (date: string) => monthOf(date) === month;
  const spends = sumAmounts(state.spends.filter((entry) => inMonth(entry.date)));
  const replenishes = sumAmounts(state.replenishes.filter((entry) => inMonth(entry.date)));
  const inflows = sumAmounts(state.inflows.filter((entry) => inMonth(entry.date)));
  const endDate = month >= monthOf(today) ? today : monthEndKey(month);
  return {
    month,
    spends,
    replenishes,
    inflows,
    net: replenishes + inflows - spends,
    endBalance: planningBalanceUntil(state, endDate),
  };
}

export function removeEvent(state: PlanningState, eventId: string): PlanningState {
  return {
    events: state.events.filter((event) => event.id !== eventId),
    spends: state.spends.filter((entry) => entry.eventId !== eventId),
    replenishes: state.replenishes.filter((entry) => entry.eventId !== eventId),
    inflows: state.inflows,
  };
}
