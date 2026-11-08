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
    await user.click(screen.getByRole('button', { name: '立即恢复正常额度' }));
    await user.click(screen.getByRole('button', { name: '确认恢复' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.restores.some((restore: { date: string }) => restore.date === today)).toBe(true);
    expect(screen.getByText('已恢复正常额度')).toBeInTheDocument();
  });

  it('shows configured daily rates in the current period', () => {
    const meal = mealFixture({
      settings: { monthlyBudget: 80000, monthlyMinimum: 45000, startDate: todayKey() },
    });
    renderWithProviders(<SettingsPage />, { meal });
    expect(screen.getByText('正常 ¥26.67')).toBeInTheDocument();
  });

  it('disables manual restore when today already has a restore', () => {
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    expect(screen.getByRole('button', { name: '今天已经恢复过' })).toBeDisabled();
  });

  it('rejects a minimum that is not less than the budget', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    const budget = screen.getByLabelText('月度餐补预算');
    await user.clear(budget);
    await user.type(budget, '400');
    await user.click(screen.getByRole('button', { name: '保存设置' }));
    expect(screen.getByRole('alert')).toHaveTextContent('月度保底必须小于月度预算');
  });

  it('saves the cycle start day', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    const cycleDay = screen.getByLabelText('周期起始日');
    await user.clear(cycleDay);
    await user.type(cycleDay, '15');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.settings.cycleStartDay).toBe(15);
  });

  it('opens the custom period calendar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    await user.click(screen.getByRole('button', { name: '自定义周期（含历史）' }));
    expect(screen.getByRole('dialog', { name: '自定义周期' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存周期' })).toBeInTheDocument();
  });

  it('changes the font scale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    await user.click(screen.getByRole('button', { name: '大' }));

    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.1');
    const saved = JSON.parse(localStorage.getItem('pocket-ledger.ui.v1') ?? '{}');
    expect(saved.fontScale).toBe(1.1);
  });
});
