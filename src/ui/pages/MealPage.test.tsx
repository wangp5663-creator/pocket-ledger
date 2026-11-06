import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatDisplayDate, todayKey } from '../../domain/dates';
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

  it("clears the today form when today's record is deleted", async () => {
    const user = userEvent.setup();
    const record = { spent: 1500, allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' };
    renderWithProviders(<MealPage />, {
      meal: { settings: { dailyAllowance: 2000, startDate: today }, records: { [today]: record } },
    });
    await user.click(screen.getAllByRole('button', { name: `删除 ${formatDisplayDate(today)}` })[0]);
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.getByLabelText('今日实际花费')).toHaveValue('');
    expect(screen.queryByText(/今日已记录/)).not.toBeInTheDocument();
  });

  it("syncs the today form after editing today's record", async () => {
    const user = userEvent.setup();
    const record = { spent: 1500, allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' };
    renderWithProviders(<MealPage />, {
      meal: { settings: { dailyAllowance: 2000, startDate: today }, records: { [today]: record } },
    });
    await user.click(screen.getAllByRole('button', { name: `编辑 ${formatDisplayDate(today)}` })[0]);
    const amount = screen.getByLabelText('修改金额');
    await user.clear(amount);
    await user.type(amount, '20');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(screen.getByLabelText('今日实际花费')).toHaveValue('20.00');
  });
});
