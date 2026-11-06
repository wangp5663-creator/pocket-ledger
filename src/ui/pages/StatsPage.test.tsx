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
      records: {},
    };
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState() });

    expect(screen.getByText('每月结余')).toBeInTheDocument();
    expect(screen.getByText('餐补额度')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText('每月净变化')).toBeInTheDocument();
    expect(screen.getByText('净变化')).toBeInTheDocument();
    expect(screen.queryByText('本月支出')).not.toBeInTheDocument();
  });
});
