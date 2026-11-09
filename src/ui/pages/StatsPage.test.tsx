import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanState } from '../../domain/planItems';
import { emptyPlanningState } from '../../domain/planning';
import { mealFixture, renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage v2', () => {
  it('shows meal periods and switches to the ledger', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      records: { [today]: { spent: 1500, updatedAt: '2026-11-01T00:00:00.000Z' } },
    });
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState(), plan: emptyPlanState() });

    expect(screen.getByText('每周期结余')).toBeInTheDocument();
    expect(screen.getByText('每日正常额度')).toBeInTheDocument();
    expect(screen.getAllByText(/–/).length).toBeGreaterThan(0);
    expect(screen.getByText(/进行中/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '每日花费' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当日结余' })).toBeInTheDocument();
    expect(screen.getByLabelText('查看周期')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows empty state without records', () => {
    renderWithProviders(<StatsPage />, {
      meal: mealFixture(),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
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
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning, plan: emptyPlanState() });
    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText(formatMonthLabel(monthOf(today)))).toBeInTheDocument();
  });

  it('switches planning chart metrics', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const planning = {
      ...emptyPlanningState(),
      spends: [{ id: 's1', eventId: 'e1', date: today, amount: 3000, createdAt: '2026-11-01T00:00:00.000Z' }],
      replenishes: [
        { id: 'r1', eventId: 'e1', date: today, amount: 1000, createdAt: '2026-11-01T00:00:00.000Z' },
      ],
      inflows: [{ id: 'i1', date: today, amount: 500, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning, plan: emptyPlanState() });
    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText('每月净变化')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '支出' }));
    expect(screen.getByText('每月支出')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '补回' }));
    expect(screen.getByText('每月补回')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '汇入' }));
    expect(screen.getByText('每月汇入')).toBeInTheDocument();
  });

  it('hides and shows the detail section', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      records: { [today]: { spent: 1500, updatedAt: '2026-11-01T00:00:00.000Z' } },
    });
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState(), plan: emptyPlanState() });

    expect(screen.getByText('每日正常额度')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '隐藏明细' }));
    expect(screen.queryByText('每日正常额度')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '每日花费' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '显示明细' }));
    expect(screen.getByText('每日正常额度')).toBeInTheDocument();
  });
});
