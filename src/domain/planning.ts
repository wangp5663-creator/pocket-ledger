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

export function firstSpendMonth(state: PlanningState, eventId: string): string | undefined {
  const spends = state.spends.filter((entry) => entry.eventId === eventId);
  if (spends.length === 0) return undefined;
  const earliest = spends.reduce((min, entry) => (entry.date < min ? entry.date : min), spends[0].date);
  return monthOf(earliest);
}

export function isEventCompleted(state: PlanningState, eventId: string): boolean {
  const progress = eventProgress(state, eventId);
  return progress.spent > 0 && progress.replenished >= progress.spent;
}

export interface EventPartition {
  ongoing: PlanningEvent[];
  completed: PlanningEvent[];
}

export function partitionEvents(state: PlanningState): EventPartition {
  const ongoing: PlanningEvent[] = [];
  const completed: PlanningEvent[] = [];

  for (const event of state.events) {
    if (isEventCompleted(state, event.id)) {
      completed.push(event);
    } else {
      ongoing.push(event);
    }
  }

  ongoing.sort((a, b) => {
    const monthA = firstSpendMonth(state, a.id);
    const monthB = firstSpendMonth(state, b.id);
    if (!monthA && !monthB) return b.createdAt.localeCompare(a.createdAt);
    if (!monthA) return 1;
    if (!monthB) return -1;
    return monthA === monthB ? b.createdAt.localeCompare(a.createdAt) : monthB.localeCompare(monthA);
  });

  return { ongoing, completed };
}

export interface CompletedEventGroup {
  month: string;
  events: PlanningEvent[];
  spends: number;
  replenishes: number;
}

function lastReplenishDate(state: PlanningState, eventId: string): string {
  const dates = state.replenishes
    .filter((entry) => entry.eventId === eventId)
    .map((entry) => entry.date)
    .sort();
  return dates[dates.length - 1] ?? '';
}

export function completedEventGroups(state: PlanningState): CompletedEventGroup[] {
  const { completed } = partitionEvents(state);
  const byMonth = new Map<string, PlanningEvent[]>();

  for (const event of completed) {
    const month = firstSpendMonth(state, event.id);
    if (!month) continue;
    const group = byMonth.get(month);
    if (group) group.push(event);
    else byMonth.set(month, [event]);
  }

  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, events]) => {
      const sorted = [...events].sort((a, b) => {
        const byDate = lastReplenishDate(state, b.id).localeCompare(lastReplenishDate(state, a.id));
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      });
      return {
        month,
        events: sorted,
        spends: sorted.reduce((total, event) => total + eventProgress(state, event.id).spent, 0),
        replenishes: sorted.reduce((total, event) => total + eventProgress(state, event.id).replenished, 0),
      };
    });
}

export function partitionInflows(
  state: PlanningState,
  today: string,
): { currentMonth: InflowEntry[]; archived: InflowEntry[] } {
  const current = monthOf(today);
  const sortDesc = (entries: InflowEntry[]) =>
    [...entries].sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );
  return {
    currentMonth: sortDesc(state.inflows.filter((entry) => monthOf(entry.date) === current)),
    archived: sortDesc(state.inflows.filter((entry) => monthOf(entry.date) !== current)),
  };
}
