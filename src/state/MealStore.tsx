import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import {
  createRestoreEvent,
  customizePeriod as customizeMealPeriod,
  normalizeMealState,
  removeMealRecord,
  restoreMealNow,
  upsertMealRecord,
  validateMealSettings,
} from '../domain/mealV2';
import type { MealSettingsV2, MealStateV2 } from '../domain/mealV2';
import { loadMealStateV2, saveMealStateV2 } from '../storage/mealV2Storage';

interface MealContextValue {
  state: MealStateV2;
  storageError: string | null;
  dismissError: () => void;
  updateSettings: (settings: MealSettingsV2) => string | null;
  saveRecord: (date: string, spent: number, note: string) => void;
  deleteRecord: (date: string) => void;
  restoreNow: () => string | null;
  customizePeriod: (startDate: string, endDate: string) => string | null;
  clearRecords: () => void;
}

const MealContext = createContext<MealContextValue | null>(null);

export function MealProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadMealStateV2());
  const [state, setState] = useState<MealStateV2>(() =>
    normalizeMealState(initial.value, todayKey()),
  );
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = saveMealStateV2(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const mutate = useCallback((updater: (previous: MealStateV2) => MealStateV2) => {
    setState((previous) => updater(normalizeMealState(previous, todayKey())));
  }, []);

  const updateSettings = useCallback((settings: MealSettingsV2): string | null => {
    const message = validateMealSettings(settings);
    if (message) return message;
    setState((previous) => {
      const normalized = normalizeMealState(previous, todayKey());
      const restores =
        normalized.restores.length > 0
          ? normalized.restores
          : [createRestoreEvent(settings, settings.startDate, new Date().toISOString())];
      return { ...normalized, settings, restores };
    });
    return null;
  }, []);

  const saveRecord = useCallback(
    (date: string, spent: number, note: string) => {
      mutate((previous) => upsertMealRecord(previous, date, spent, note, new Date().toISOString()));
    },
    [mutate],
  );

  const deleteRecord = useCallback(
    (date: string) => {
      mutate((previous) => removeMealRecord(previous, date));
    },
    [mutate],
  );

  const restoreNow = useCallback((): string | null => {
    const result = restoreMealNow(state, todayKey());
    if (result.error) return result.error;
    setState(result.state);
    return null;
  }, [state]);

  const customizePeriod = useCallback(
    (startDate: string, endDate: string): string | null => {
      const result = customizeMealPeriod(state, todayKey(), startDate, endDate);
      if (result.error) return result.error;
      setState(result.state);
      return null;
    },
    [state],
  );

  const clearRecords = useCallback(() => {
    setState((previous) => {
      const settings = { ...previous.settings, startDate: todayKey() };
      return {
        settings,
        records: {},
        restores: [createRestoreEvent(settings, settings.startDate, new Date().toISOString())],
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      storageError,
      dismissError,
      updateSettings,
      saveRecord,
      deleteRecord,
      restoreNow,
      customizePeriod,
      clearRecords,
    }),
    [
      state,
      storageError,
      dismissError,
      updateSettings,
      saveRecord,
      deleteRecord,
      restoreNow,
      customizePeriod,
      clearRecords,
    ],
  );

  return <MealContext.Provider value={value}>{children}</MealContext.Provider>;
}

export function useMeal(): MealContextValue {
  const value = useContext(MealContext);
  if (!value) throw new Error('useMeal must be used within MealProvider');
  return value;
}
