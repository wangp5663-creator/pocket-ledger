import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { PlanningPage } from './PlanningPage';

describe('PlanningPage', () => {
  it('creates an event and records a spend linked to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '买电脑');
    await user.click(screen.getByRole('button', { name: '创建事项' }));
    expect(await screen.findByText('买电脑')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.type(screen.getByLabelText('金额'), '3000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('待补 ¥3000.00')).toBeInTheDocument();
  });

  it('does not show the completed badge for a new event with no spending', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '新计划');
    await user.click(screen.getByRole('button', { name: '创建事项' }));

    expect(await screen.findByText('新计划')).toBeInTheDocument();
    expect(screen.queryByText('已补齐')).not.toBeInTheDocument();
  });

  it('records and deletes an inflow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.click(screen.getByRole('tab', { name: '汇入' }));
    await user.type(screen.getByLabelText('金额'), '500');
    await user.click(screen.getByRole('button', { name: '保存' }));

    // "+¥500.00" also appears in the balance/净变化 summary tiles, so assert it is
    // present at least once here; the row is removed and re-asserted below.
    const amounts = await screen.findAllByText('+¥500.00');
    expect(amounts.length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '删除' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.queryByText('+¥500.00')).not.toBeInTheDocument();
  });
});
