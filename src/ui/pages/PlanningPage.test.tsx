import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatShortMonth, todayKey } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { PlanningPage } from './PlanningPage';

const createdAt = '2026-11-01T00:00:00.000Z';

function completedFixture(): PlanningState {
  return {
    events: [{ id: 'e1', name: '已补完', replenishPlan: [], createdAt }],
    spends: [{ id: 's1', eventId: 'e1', date: '2026-11-02', amount: 100000, createdAt }],
    replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-03', amount: 100000, createdAt }],
    inflows: [],
  };
}

describe('PlanningPage', () => {
  it('creates an event and records a spend linked to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '买电脑');
    await user.click(screen.getByRole('button', { name: '创建事项' }));
    expect(await screen.findByText('买电脑')).toBeInTheDocument();
    expect(screen.getByText('未支出')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.type(screen.getByLabelText('金额'), '3000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('待补回 ¥3000.00')).toBeInTheDocument();
  });

  it('does not mark a new event as completed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '新计划');
    await user.click(screen.getByRole('button', { name: '创建事项' }));

    expect(await screen.findByText('新计划')).toBeInTheDocument();
    expect(screen.queryByText('已补回')).not.toBeInTheDocument();
  });

  it('records and deletes a current-month inflow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.click(screen.getByRole('tab', { name: '汇入' }));
    await user.type(screen.getByLabelText('金额'), '500');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect((await screen.findAllByText('+¥500.00')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这笔汇入？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.queryByText('+¥500.00')).not.toBeInTheDocument();
  });

  it('moves completed events behind the 已补回 entry link', () => {
    renderWithProviders(<PlanningPage />, { planning: completedFixture() });
    const link = screen.getByRole('link', { name: /已补回/ });
    expect(link).toHaveAttribute('href', '/planning/completed');
    expect(link).toHaveTextContent('1 个');
    expect(screen.queryByText('已补完')).not.toBeInTheDocument();
  });

  it('shows the first spend month badge', () => {
    const planning: PlanningState = {
      events: [{ id: 'e2', name: '九月事项', replenishPlan: [], createdAt }],
      spends: [{ id: 's2', eventId: 'e2', date: '2026-09-03', amount: 100000, createdAt }],
      replenishes: [],
      inflows: [],
    };
    renderWithProviders(<PlanningPage />, { planning });
    expect(screen.getByText(formatShortMonth('2026-09', todayKey()))).toBeInTheDocument();
  });

  it('links to the plans page', () => {
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });
    expect(screen.getByRole('link', { name: /用款计划/ })).toHaveAttribute('href', '/planning/plans');
  });
});
