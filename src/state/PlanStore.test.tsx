import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PLAN_ITEMS_STORAGE_KEY } from '../storage/planItemsStorage';
import { PlanProvider, usePlan } from './PlanStore';

describe('PlanStore', () => {
  it('adds, updates, deletes and clears plan items', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <PlanProvider>{children}</PlanProvider>;
    const { result } = renderHook(() => usePlan(), { wrapper });

    act(() => {
      result.current.addItem({
        spendMonth: '2026-11',
        title: '换电脑',
        amount: 500000,
        replenishMonth: '2026-12',
      });
    });
    expect(result.current.items).toHaveLength(1);

    const id = result.current.items[0].id;
    act(() => {
      result.current.updateItem(id, {
        spendMonth: '2026-11',
        title: '换新电脑',
        amount: 600000,
        replenishMonth: '2027-01',
      });
    });
    expect(result.current.items[0]).toMatchObject({ title: '换新电脑', amount: 600000 });

    const stored = JSON.parse(localStorage.getItem(PLAN_ITEMS_STORAGE_KEY) ?? '{}');
    expect(stored.items[0].title).toBe('换新电脑');

    act(() => {
      result.current.clearAll();
    });
    expect(result.current.items).toEqual([]);
  });
});
