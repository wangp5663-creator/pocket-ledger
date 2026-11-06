import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createId } from '../domain/id';
import { emptyPlanningState, removeEvent } from '../domain/planning';
import type {
  InflowEntry,
  PlanningEvent,
  PlanningState,
  ReplenishEntry,
  ReplenishPlanItem,
  SpendEntry,
} from '../domain/planning';
import { loadPlanningState, savePlanningState } from '../storage/planningStorage';

export type EntryKind = 'spend' | 'replenish' | 'inflow';

export interface EntryInput {
  kind: EntryKind;
  date: string;
  amount: number;
  note?: string;
  eventId?: string;
}

export interface EventInput {
  name: string;
  plannedTotal?: number;
  note?: string;
  replenishPlan: ReplenishPlanItem[];
}

interface PlanningContextValue {
  state: PlanningState;
  storageError: string | null;
  dismissError: () => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: EventInput) => void;
  deleteEvent: (id: string) => void;
  addEntry: (input: EntryInput) => void;
  updateEntry: (kind: EntryKind, id: string, input: Omit<EntryInput, 'kind'>) => void;
  deleteEntry: (kind: EntryKind, id: string) => void;
  clearAll: () => void;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadPlanningState());
  const [state, setState] = useState<PlanningState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = savePlanningState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const addEvent = useCallback((input: EventInput) => {
    const event: PlanningEvent = {
      id: createId(),
      name: input.name,
      plannedTotal: input.plannedTotal,
      note: input.note,
      replenishPlan: input.replenishPlan,
      createdAt: new Date().toISOString(),
    };
    setState((previous) => ({ ...previous, events: [...previous.events, event] }));
  }, []);

  const updateEvent = useCallback((id: string, input: EventInput) => {
    setState((previous) => ({
      ...previous,
      events: previous.events.map((event) =>
        event.id === id
          ? {
              ...event,
              name: input.name,
              plannedTotal: input.plannedTotal,
              note: input.note,
              replenishPlan: input.replenishPlan,
            }
          : event,
      ),
    }));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setState((previous) => removeEvent(previous, id));
  }, []);

  const addEntry = useCallback((input: EntryInput) => {
    const base = {
      id: createId(),
      date: input.date,
      amount: input.amount,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    if (input.kind === 'inflow') {
      const entry: InflowEntry = base;
      setState((previous) => ({ ...previous, inflows: [...previous.inflows, entry] }));
      return;
    }
    const eventId = input.eventId;
    if (!eventId) {
      throw new Error('eventId is required for spend and replenish entries');
    }
    if (input.kind === 'spend') {
      setState((previous) => {
        if (!previous.events.some((event) => event.id === eventId)) return previous;
        const entry: SpendEntry = { ...base, eventId };
        return { ...previous, spends: [...previous.spends, entry] };
      });
      return;
    }
    setState((previous) => {
      if (!previous.events.some((event) => event.id === eventId)) return previous;
      const entry: ReplenishEntry = { ...base, eventId };
      return { ...previous, replenishes: [...previous.replenishes, entry] };
    });
  }, []);

  const updateEntry = useCallback((kind: EntryKind, id: string, input: Omit<EntryInput, 'kind'>) => {
    setState((previous) => {
      if (kind === 'inflow') {
        return {
          ...previous,
          inflows: previous.inflows.map((entry) =>
            entry.id === id
              ? { ...entry, date: input.date, amount: input.amount, note: input.note }
              : entry,
          ),
        };
      }
      if (input.eventId !== undefined && !previous.events.some((event) => event.id === input.eventId)) {
        return previous;
      }
      function updateLinked<T extends SpendEntry | ReplenishEntry>(entries: T[]): T[] {
        return entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                date: input.date,
                amount: input.amount,
                note: input.note,
                eventId: input.eventId ?? entry.eventId,
              }
            : entry,
        );
      }
      if (kind === 'spend') return { ...previous, spends: updateLinked(previous.spends) };
      return { ...previous, replenishes: updateLinked(previous.replenishes) };
    });
  }, []);

  const deleteEntry = useCallback((kind: EntryKind, id: string) => {
    setState((previous) => {
      if (kind === 'inflow') return { ...previous, inflows: previous.inflows.filter((entry) => entry.id !== id) };
      if (kind === 'spend') return { ...previous, spends: previous.spends.filter((entry) => entry.id !== id) };
      return { ...previous, replenishes: previous.replenishes.filter((entry) => entry.id !== id) };
    });
  }, []);

  const clearAll = useCallback(() => setState(emptyPlanningState()), []);

  const value = useMemo(
    () => ({
      state,
      storageError,
      dismissError,
      addEvent,
      updateEvent,
      deleteEvent,
      addEntry,
      updateEntry,
      deleteEntry,
      clearAll,
    }),
    [state, storageError, dismissError, addEvent, updateEvent, deleteEvent, addEntry, updateEntry, deleteEntry, clearAll],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning(): PlanningContextValue {
  const value = useContext(PlanningContext);
  if (!value) throw new Error('usePlanning must be used within PlanningProvider');
  return value;
}
