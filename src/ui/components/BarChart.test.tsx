import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from './BarChart';

describe('BarChart', () => {
  it('renders a formatted value above every bar', () => {
    render(
      <BarChart
        data={[
          { label: '11月', value: 12345 },
          { label: '12月', value: -5000 },
        ]}
        formatValue={(value) => `v${value}`}
      />,
    );

    expect(screen.getByText('v12345')).toBeInTheDocument();
    expect(screen.getByText('v-5000')).toBeInTheDocument();
    expect(screen.getByText('11月')).toBeInTheDocument();
    expect(screen.getByText('12月')).toBeInTheDocument();
  });
});
