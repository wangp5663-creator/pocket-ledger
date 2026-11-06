import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { mealFixture, renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage v2', () => {
  it('shows meal periods and switches to planning', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      records: { [today]: { spent: 1500, updatedAt: '2026-11-01T00:00:00.000Z' } },
    });
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState() });

    expect(screen.getByText('每期结余')).toBeInTheDocument();
    expect(screen.getByText('开始额度')).toBeInTheDocument();
    expect(screen.getByText(/–/)).toBeInTheDocument();
    expect(screen.getByText(/进行中/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows empty state without records', () => {
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning: emptyPlanningState() });
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows localized planning months', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const planning = {
      events: [],
      spends: [],
      replenishes: [],
      inflows: [{ id: 'i1', date: today, amount: 5000, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning });
    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText(formatMonthLabel(monthOf(today)))).toBeInTheDocument();
  });
});
