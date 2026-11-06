import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { todayKey } from '../../domain/dates';
import { renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage', () => {
  it('switches between meal and planning statistics', async () => {
    const user = userEvent.setup();
    const meal = {
      settings: { dailyAllowance: 2000, startDate: todayKey() },
      records: { [todayKey()]: { spent: 1500, allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' } },
    };
    const planning = {
      ...emptyPlanningState(),
      inflows: [{ id: 'i1', date: todayKey(), amount: 500, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal, planning });

    expect(screen.getByText('每月结余')).toBeInTheDocument();
    expect(screen.getByText('餐补额度')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText('每月净变化')).toBeInTheDocument();
    expect(screen.getByText('净变化')).toBeInTheDocument();
    expect(screen.getByText('补回')).toBeInTheDocument();
  });

  it('shows an empty state when there is no data', () => {
    const today = todayKey();
    const meal = { settings: { dailyAllowance: 2000, startDate: today }, records: {} };
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState() });

    expect(screen.getByText('还没有数据')).toBeInTheDocument();
    expect(screen.queryByText('每月结余')).not.toBeInTheDocument();
  });

  it('renders negative balances with the sign before the currency symbol', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = {
      settings: { dailyAllowance: 2000, startDate: today },
      records: { [today]: { spent: 1500, allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' } },
    };
    const planning = {
      events: [],
      spends: [{ id: 's1', eventId: 'e1', date: today, amount: 100000, createdAt: '2026-11-01T00:00:00.000Z' }],
      replenishes: [],
      inflows: [{ id: 'i1', date: today, amount: 50000, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal, planning });

    await user.click(screen.getByRole('tab', { name: '规划账' }));

    expect(screen.getAllByText('-¥500.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('¥-500.00')).not.toBeInTheDocument();
  });
});
