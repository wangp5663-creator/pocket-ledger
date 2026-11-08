import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { upsertMealRecord, type MealStateV2 } from '../../domain/mealV2';
import { mealFixture, renderWithProviders } from '../../test/render';
import { MealRecordsPage } from './MealRecordsPage';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: todayKey() };

function makeState(spent: number): MealStateV2 {
  return upsertMealRecord(mealFixture({ settings }), todayKey(), spent, '', new Date().toISOString());
}

describe('MealRecordsPage', () => {
  it('lists periods and returns to the meal page', () => {
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    expect(screen.getByRole('heading', { name: '历史周期' })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(formatDisplayDate(todayKey()))).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '‹ 返回餐补' })).toHaveAttribute('href', '/');
  });

  it('edits a record from the history page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    await user.click(screen.getByRole('button', { name: `编辑 ${formatDisplayDate(todayKey())}` }));
    const input = screen.getByLabelText('修改金额');
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(await screen.findByText(/额度 ¥20\.00 · 花费 ¥20\.00/)).toBeInTheDocument();
  });

  it('confirms before deleting a record', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    await user.click(screen.getByRole('button', { name: `删除 ${formatDisplayDate(todayKey())}` }));
    expect(screen.getByText('删除这条记录？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.queryByRole('button', { name: `删除 ${formatDisplayDate(todayKey())}` })).not.toBeInTheDocument();
  });
});
