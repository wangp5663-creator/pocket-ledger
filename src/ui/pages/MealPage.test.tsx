import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { upsertMealRecord, type MealStateV2 } from '../../domain/mealV2';
import { mealFixture, renderWithProviders } from '../../test/render';
import { MealPage } from './MealPage';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: todayKey() };

function makeState(spent: number): MealStateV2 {
  return upsertMealRecord(mealFixture({ settings }), todayKey(), spent, '', new Date().toISOString());
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

  it('replaces the sad message with a deficit reminder', () => {
    renderWithProviders(<MealPage />, { meal: makeState(3000) });
    expect(screen.queryByText('有点超支了…')).not.toBeInTheDocument();
    expect(screen.getByText(/超支 ¥10\.00|本周期已结束|即使每天不花/)).toBeInTheDocument();
  });

  it('shows the minimum phase copy after crossing the free limit', () => {
    renderWithProviders(<MealPage />, { meal: makeState(17000) });
    expect(screen.getByText(/保底 ¥\d+\.\d{2}\/天 · 无自由额度/)).toBeInTheDocument();
    expect(screen.getAllByText(/自由额度已用完|超支/).length).toBeGreaterThan(0);
  });

  it('uses configured daily rates in labels', () => {
    const customSettings = { monthlyBudget: 80000, monthlyMinimum: 45000, startDate: todayKey() };
    const state = upsertMealRecord(
      mealFixture({ settings: customSettings }),
      todayKey(),
      1000,
      '',
      new Date().toISOString(),
    );
    renderWithProviders(<MealPage />, { meal: state });
    expect(screen.getByText(/正常 ¥26.67/)).toBeInTheDocument();
  });

  it('shows the threshold sheet after crossing on save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealFixture() });
    await user.type(screen.getByLabelText('今日实际花费'), '170');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect((await screen.findAllByText('自由额度已用完')).length).toBeGreaterThan(0);
  });

  it('links to the history page', () => {
    renderWithProviders(<MealPage />, { meal: mealFixture({ settings }) });
    expect(screen.getByRole('link', { name: /历史周期/ })).toHaveAttribute('href', '/meal/records');
  });
});
