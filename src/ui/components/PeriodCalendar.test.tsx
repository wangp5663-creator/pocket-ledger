import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeriodCalendar } from './PeriodCalendar';

describe('PeriodCalendar', () => {
  it('allows selecting a start date before the initial start', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PeriodCalendar
        initialStart="2026-11-06"
        initialEnd="2026-11-30"
        today="2026-11-07"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '30' }));
    await user.click(screen.getByRole('button', { name: '保存周期' }));

    expect(onConfirm).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
  });
});
