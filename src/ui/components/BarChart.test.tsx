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

  it('marks long daily series as horizontally scrollable', () => {
    const data = Array.from({ length: 30 }, (_, index) => ({
      label: `11/${index + 1}`,
      value: index * 100,
    }));
    const { container } = render(<BarChart data={data} scroll scrollKey="daily" />);

    expect(container.querySelector('.bar-chart--scroll')).toBeInTheDocument();
    expect(container.querySelectorAll('.bar-chart__item')).toHaveLength(30);
  });
});
