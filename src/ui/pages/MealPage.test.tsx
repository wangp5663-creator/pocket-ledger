import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { MealPage } from './MealPage';

describe('MealPage', () => {
  const today = todayKey();
  const mealState = { settings: { dailyAllowance: 2000, startDate: today }, records: {} };

  it('saves today spending and updates the balance', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealState });
    await user.type(screen.getByLabelText('今日实际花费'), '15');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/已记录 1 天/)).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[today].spent).toBe(1500);
    expect(saved.records[today].allowance).toBe(2000);
  });

  it('shows an error for invalid amounts and does not save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealState });
    await user.type(screen.getByLabelText('今日实际花费'), 'abc');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效金额');
    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[today]).toBeUndefined();
  });
});
