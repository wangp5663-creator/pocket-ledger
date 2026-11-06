import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import type { MealSettings, MealState } from '../domain/meal';
import { loadMealState, saveMealState } from '../storage/mealStorage';

interface MealContextValue {
  state: MealState;
  storageError: string | null;
  dismissError: () => void;
  saveRecord: (date: string, spent: number, note: string, allowance: number) => void;
  deleteRecord: (date: string) => void;
  updateSettings: (settings: MealSettings) => string | null;
  clearRecords: () => void;
}

const MealContext = createContext<MealContextValue | null>(null);

export function MealProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadMealState());
  const [state, setState] = useState<MealState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = saveMealState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const saveRecord = useCallback((date: string, spent: number, note: string, allowance: number) => {
    setState((previous) => {
      const existing = previous.records[date];
      return {
        ...previous,
        records: {
          ...previous.records,
          [date]: {
            spent,
            note: note.trim() || undefined,
            allowance: existing ? existing.allowance : allowance,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const deleteRecord = useCallback((date: string) => {
    setState((previous) => {
      const records = { ...previous.records };
      delete records[date];
      return { ...previous, records };
    });
  }, []);

  const updateSettings = useCallback(
    (settings: MealSettings): string | null => {
      if (!Number.isInteger(settings.dailyAllowance) || settings.dailyAllowance <= 0) {
        return '每日餐补必须是大于 0 的金额';
      }
      const today = todayKey();
      if (!settings.startDate) return '请选择起始日期';
      if (settings.startDate > today) return '起始日期不能晚于今天';
      const earliest = Object.keys(state.records).sort()[0];
      if (earliest && settings.startDate > earliest) return '起始日期不能晚于已有记录的最早日期';
      setState((previous) => ({ ...previous, settings }));
      return null;
    },
    [state.records],
  );

  const clearRecords = useCallback(() => {
    setState((previous) => ({
      ...previous,
      settings: { ...previous.settings, startDate: todayKey() },
      records: {},
    }));
  }, []);

  const value = useMemo(
    () => ({ state, storageError, dismissError, saveRecord, deleteRecord, updateSettings, clearRecords }),
    [state, storageError, dismissError, saveRecord, deleteRecord, updateSettings, clearRecords],
  );

  return <MealContext.Provider value={value}>{children}</MealContext.Provider>;
}

export function useMeal(): MealContextValue {
  const value = useContext(MealContext);
  if (!value) throw new Error('useMeal must be used within MealProvider');
  return value;
}
