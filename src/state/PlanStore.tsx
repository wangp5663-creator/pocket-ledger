import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createId } from '../domain/id';
import { emptyPlanState } from '../domain/planItems';
import type { PlanItem, PlanItemDraft, PlanState } from '../domain/planItems';
import { loadPlanState, savePlanState } from '../storage/planItemsStorage';

interface PlanContextValue {
  items: PlanItem[];
  storageError: string | null;
  dismissError: () => void;
  addItem: (input: PlanItemDraft) => void;
  updateItem: (id: string, input: PlanItemDraft) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadPlanState());
  const [state, setState] = useState<PlanState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = savePlanState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const addItem = useCallback((input: PlanItemDraft) => {
    const item: PlanItem = {
      id: createId(),
      spendMonth: input.spendMonth,
      title: input.title.trim(),
      amount: input.amount,
      replenishMonth: input.replenishMonth,
      createdAt: new Date().toISOString(),
    };
    setState((previous) => ({ ...previous, items: [...previous.items, item] }));
  }, []);

  const updateItem = useCallback((id: string, input: PlanItemDraft) => {
    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === id
          ? {
              ...item,
              spendMonth: input.spendMonth,
              title: input.title.trim(),
              amount: input.amount,
              replenishMonth: input.replenishMonth,
            }
          : item,
      ),
    }));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState((previous) => ({ ...previous, items: previous.items.filter((item) => item.id !== id) }));
  }, []);

  const clearAll = useCallback(() => setState(emptyPlanState()), []);

  const value = useMemo(
    () => ({ items: state.items, storageError, dismissError, addItem, updateItem, deleteItem, clearAll }),
    [state.items, storageError, dismissError, addItem, updateItem, deleteItem, clearAll],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error('usePlan must be used within PlanProvider');
  return value;
}
