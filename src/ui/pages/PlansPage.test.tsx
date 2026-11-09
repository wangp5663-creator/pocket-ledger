import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addMonths, formatShortMonth, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanState, type PlanState } from '../../domain/planItems';
import { renderWithProviders } from '../../test/render';
import { PlansPage } from './PlansPage';

function fixture(): PlanState {
  const current = monthOf(todayKey());
  return {
    items: [
      {
        id: 'p1',
        spendMonth: current,
        title: '换电脑',
        amount: 500000,
        replenishMonth: addMonths(current, 1),
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  };
}

describe('PlansPage', () => {
  it('shows the empty state and creates a plan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: emptyPlanState(), route: '/planning/plans' });
    expect(screen.getByText('还没有用款计划')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '＋ 新建' }));
    await user.type(screen.getByLabelText('事件内容'), '换电脑');
    await user.type(screen.getByLabelText('金额'), '5000');
    await user.click(screen.getByRole('button', { name: '创建计划' }));

    expect((await screen.findAllByText('换电脑')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥5000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
  });

  it('adjusts the timeline length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '增加一个月' }));
    expect(screen.getByText('近 4 个月')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '减少一个月' }));
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
  });

  it('edits and deletes a plan item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });

    await user.click(screen.getByRole('button', { name: /换电脑/ }));
    const amount = screen.getByLabelText('金额');
    await user.clear(amount);
    await user.type(amount, '6000');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect((await screen.findAllByText('¥6000.00')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /换电脑/ }));
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这条计划？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(await screen.findByText('还没有用款计划')).toBeInTheDocument();
  });

  it('shows monthly totals and cumulative values', () => {
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });
    expect(screen.getByText('计划支出')).toBeInTheDocument();
    expect(screen.getByText('计划回补')).toBeInTheDocument();
    expect(screen.getByText('累计')).toBeInTheDocument();
    expect(screen.getAllByText(/净额/).length).toBeGreaterThan(0);
    expect(screen.getByText('支出 ¥5000.00')).toBeInTheDocument();

    const current = monthOf(todayKey());
    expect(
      screen.getByRole('button', {
        name: `${formatShortMonth(current, todayKey())} 换电脑 ¥5000.00 回补 ${formatShortMonth(addMonths(current, 1), todayKey())}`,
      }),
    ).toBeInTheDocument();
  });
});
