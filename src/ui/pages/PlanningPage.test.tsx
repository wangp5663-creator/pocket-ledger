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
});
