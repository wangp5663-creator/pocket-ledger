import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { upsertMealRecord, type MealStateV2 } from '../../domain/mealV2';
import { mealFixture, renderWithProviders } from '../../test/render';
import { MealPage } from './MealPage';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: todayKey() };

function makeState(spent: number): MealStateV2 {
  const state = mealFixture({ settings });
  return upsertMealRecord(state, todayKey(), spent, '', new Date().toISOString());
}

describe('MealPage v2', () => {
  it('saves today spending and shows happy state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealFixture({ settings }) });
    await user.type(screen.getByLabelText('今日实际花费'), '15');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/已记录 1 天/)).toBeInTheDocument();
    expect(screen.getByText('真棒！今天也攒下啦')).toBeInTheDocument();
  });

  it('shows unhappy state when balance is negative', () => {
    renderWithProviders(<MealPage />, { meal: makeState(3000) });
    expect(screen.getByText('有点超支了…')).toBeInTheDocument();
  });

  it('shows conservative state after crossing the free limit', () => {
    renderWithProviders(<MealPage />, { meal: makeState(17000) });
    expect(screen.getByText(/保底 ¥15.00/)).toBeInTheDocument();
    expect(screen.getByText(/没有多余的钱可以随意消费/)).toBeInTheDocument();
  });
});
