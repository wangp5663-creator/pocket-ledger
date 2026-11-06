import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_V2_STORAGE_KEY } from '../../storage/mealV2Storage';
import { mealFixture, renderWithProviders } from '../../test/render';
import { BackfillPage } from './BackfillPage';

describe('BackfillPage v2', () => {
  it('records a missing date', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const missingDate = addDays(today, -1);
    const meal = mealFixture({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: missingDate },
    });
    renderWithProviders(<BackfillPage />, { meal });

    await user.type(screen.getByLabelText(`${missingDate} 金额`), '10');
    await user.click(screen.getByRole('button', { name: `保存 ${missingDate}` }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.records[missingDate].spent).toBe(1000);
    expect(screen.queryByLabelText(`${missingDate} 金额`)).not.toBeInTheDocument();
  });
});
