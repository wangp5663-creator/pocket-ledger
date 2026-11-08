import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatMonthLabel } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { CompletedEventsPage } from './CompletedEventsPage';

const createdAt = '2026-11-01T00:00:00.000Z';

const completed: PlanningState = {
  events: [{ id: 'e1', name: '已补完', replenishPlan: [], createdAt }],
  spends: [{ id: 's1', eventId: 'e1', date: '2026-09-03', amount: 100000, createdAt }],
  replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-05', amount: 100000, createdAt }],
  inflows: [],
};

describe('CompletedEventsPage', () => {
  it('groups completed events by first spend month', () => {
    renderWithProviders(<CompletedEventsPage />, { planning: completed, route: '/planning/completed' });
    expect(screen.getByRole('heading', { name: '已补回' })).toBeInTheDocument();
    expect(screen.getByText(formatMonthLabel('2026-09'))).toBeInTheDocument();
    expect(screen.getByText('已补完')).toBeInTheDocument();
    expect(screen.getAllByText('已补回').length).toBeGreaterThan(0);
    expect(screen.getByText(/支出 ¥1000\.00 · 补回 ¥1000\.00 · 1 个/)).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(<CompletedEventsPage />, {
      planning: emptyPlanningState(),
      route: '/planning/completed',
    });
    expect(screen.getByText('还没有已补回的事项')).toBeInTheDocument();
  });
});
