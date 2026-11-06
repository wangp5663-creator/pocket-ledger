import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from './domain/planning';
import { mealFixture, renderWithProviders } from './test/render';
import App from './App';

describe('App', () => {
  it('shows onboarding when the meal start date is empty', () => {
    renderWithProviders(<App />, {
      meal: mealFixture({ settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' } }),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('button', { name: '开始记账' })).toBeInTheDocument();
  });

  it('renders the bottom navigation after onboarding', () => {
    renderWithProviders(<App />, {
      meal: mealFixture(),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('link', { name: '餐补' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '规划账' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '设置' })).toBeInTheDocument();
  });

  it('renders the selected route and marks its tab active', () => {
    renderWithProviders(<App />, {
      route: '/stats',
      meal: mealFixture(),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('heading', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toHaveClass('is-active');
  });
});
