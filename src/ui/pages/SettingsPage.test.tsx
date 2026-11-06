import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('saves a new daily allowance', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = { settings: { dailyAllowance: 2000, startDate: today }, records: {} };
    renderWithProviders(<SettingsPage />, { meal });

    const input = screen.getByLabelText('每日餐补金额');
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.settings.dailyAllowance).toBe(2500);
    expect(screen.getByText('设置已保存')).toBeInTheDocument();
  });

  it('resets the start date input after clearing meal data', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = {
      settings: { dailyAllowance: 2000, startDate: addDays(today, -5) },
      records: {},
    };
    renderWithProviders(<SettingsPage />, { meal });

    await user.click(screen.getByRole('button', { name: '清空餐补数据' }));
    await user.click(screen.getByRole('button', { name: '确认清空' }));

    expect(screen.getByLabelText('起始日期（只能提前）')).toHaveValue(today);
  });
});
