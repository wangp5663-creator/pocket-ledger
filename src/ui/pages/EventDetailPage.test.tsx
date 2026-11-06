import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { EventDetailPage } from './EventDetailPage';

const planning: PlanningState = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [{ month: '2026-12', amount: 300000 }],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 500000, createdAt: '2026-11-02T00:00:00.000Z' },
  ],
  replenishes: [
    { id: 'r1', eventId: 'e1', date: '2026-11-05', amount: 200000, createdAt: '2026-11-05T00:00:00.000Z' },
  ],
  inflows: [],
};

describe('EventDetailPage', () => {
  it('shows progress, plan comparison and timeline', () => {
    renderWithProviders(
      <Routes>
        <Route path="/planning/events/:eventId" element={<EventDetailPage />} />
      </Routes>,
      { route: '/planning/events/e1', planning },
    );

    expect(screen.getByText('待补 ¥3000.00')).toBeInTheDocument();
    expect(screen.getByText('补回计划 vs 实际')).toBeInTheDocument();
    expect(screen.getByText('2026年12月')).toBeInTheDocument();
    expect(screen.getByText('当时待补 ¥5000.00')).toBeInTheDocument();
    expect(screen.getByText('当时待补 ¥3000.00')).toBeInTheDocument();
  });

  it('shows 暂无支出 for an event without spending', () => {
    const zero: PlanningState = {
      events: [planning.events[0]],
      spends: [],
      replenishes: [],
      inflows: [],
    };
    renderWithProviders(
      <Routes>
        <Route path="/planning/events/:eventId" element={<EventDetailPage />} />
      </Routes>,
      { route: '/planning/events/e1', planning: zero },
    );

    expect(screen.getByText('暂无支出')).toBeInTheDocument();
    expect(screen.queryByText('已补齐')).not.toBeInTheDocument();
  });
});
