import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_V2_STORAGE_KEY } from '../../storage/mealV2Storage';
import { mealFixture, renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage v2', () => {
  it('saves monthly budget and minimum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    const budget = screen.getByLabelText('月度餐补预算');
    const minimum = screen.getByLabelText('月度保底');
    await user.clear(budget);
    await user.type(budget, '750');
    await user.clear(minimum);
    await user.type(minimum, '450');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.settings.monthlyBudget).toBe(75000);
    expect(saved.settings.monthlyMinimum).toBe(45000);
    expect(screen.getByText('设置已保存，下次恢复时生效')).toBeInTheDocument();
  });

  it('manually restores and adds today restore', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: addDays(today, -5) },
    });
    renderWithProviders(<SettingsPage />, { meal });
    await user.click(screen.getByRole('button', { name: '立即恢复 20 元额度' }));
    await user.click(screen.getByRole('button', { name: '确认恢复' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.restores.some((restore: { date: string }) => restore.date === today)).toBe(true);
    expect(screen.getByText('已恢复 20 元额度')).toBeInTheDocument();
  });
});
