import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addMonths, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { InflowsPage } from './InflowsPage';

const createdAt = '2026-11-01T00:00:00.000Z';

function archivedFixture(): { state: PlanningState; month: string } {
  const month = addMonths(monthOf(todayKey()), -1);
  return {
    month,
    state: {
      ...emptyPlanningState(),
      inflows: [{ id: 'i1', date: `${month}-15`, amount: 50000, note: '上月红包', createdAt }],
    },
  };
}

describe('InflowsPage', () => {
  it('lists archived inflows by month', () => {
    const { state, month } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    expect(screen.getByRole('heading', { name: '汇入记录' })).toBeInTheDocument();
    expect(screen.getByText(formatMonthLabel(month))).toBeInTheDocument();
    expect(screen.getByText('上月红包')).toBeInTheDocument();
    expect(screen.getByText('+¥500.00')).toBeInTheDocument();
  });

  it('edits an archived inflow', async () => {
    const user = userEvent.setup();
    const { state } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    await user.click(screen.getByRole('button', { name: '编辑' }));
    const amount = screen.getByLabelText('金额');
    await user.clear(amount);
    await user.type(amount, '600');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('+¥600.00')).toBeInTheDocument();
  });

  it('deletes an archived inflow after confirmation', async () => {
    const user = userEvent.setup();
    const { state } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这笔汇入？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.getByText('还没有历史汇入')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(<InflowsPage />, { planning: emptyPlanningState(), route: '/planning/inflows' });
    expect(screen.getByText('还没有历史汇入')).toBeInTheDocument();
  });
});
