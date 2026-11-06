import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatDisplayDate, todayKey } from '../../domain/dates';
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
    expect(screen.getByText('保底 ¥15.00/天 · 无自由额度')).toBeInTheDocument();
    expect(screen.getByText(/没有多余的钱可以随意消费/)).toBeInTheDocument();
  });

  it('uses configured daily rates in labels', () => {
    const customSettings = { monthlyBudget: 80000, monthlyMinimum: 45000, startDate: todayKey() };
    const state = upsertMealRecord(
      mealFixture({ settings: customSettings }),
      todayKey(),
      30000,
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
    expect(await screen.findByText('自由额度用完了')).toBeInTheDocument();
  });

  it('warns when deleting a record changes the phase', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    renderWithProviders(<MealPage />, { meal: makeState(17000) });
    await user.click(screen.getByRole('button', { name: `删除 ${formatDisplayDate(today)}` }));
    expect(screen.getByText(/删除会改变当前阶段/)).toBeInTheDocument();
  });
});
