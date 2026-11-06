import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { BackfillPage } from './BackfillPage';

describe('BackfillPage', () => {
  it('records a missing date and removes it from the list', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const missingDate = addDays(today, -1);
    const meal = { settings: { dailyAllowance: 2000, startDate: missingDate }, records: {} };
    renderWithProviders(<BackfillPage />, { meal });

    await user.type(screen.getByLabelText(`${missingDate} 金额`), '10');
    await user.click(screen.getByRole('button', { name: `保存 ${missingDate}` }));

    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[missingDate].spent).toBe(1000);
    expect(screen.queryByLabelText(`${missingDate} 金额`)).not.toBeInTheDocument();
  });
});
