/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));

import { render, screen } from '@testing-library/react';
import { PillarBalanceChart, PillarData } from './pillar-balance-chart';

const mockData: PillarData[] = [
  { pillar: 'Product Education', actual: 27, target: 25 },
  { pillar: 'Social Proof', actual: 10, target: 20 },
  { pillar: 'Industry Trends', actual: 35, target: 20 },
  { pillar: 'Behind the Scenes', actual: 14, target: 15 },
  { pillar: 'Community & Culture', actual: 14, target: 20 },
];

describe('PillarBalanceChart', () => {
  it('renders with data-testid', () => {
    render(<PillarBalanceChart data={mockData} />);
    expect(screen.getByTestId('pillar-balance-chart')).toBeInTheDocument();
  });

  it('renders all pillar labels', () => {
    render(<PillarBalanceChart data={mockData} />);
    expect(screen.getByText('Product Education')).toBeInTheDocument();
    expect(screen.getByText('Social Proof')).toBeInTheDocument();
    expect(screen.getByText('Industry Trends')).toBeInTheDocument();
  });

  it('renders 5 pillar rows', () => {
    render(<PillarBalanceChart data={mockData} />);
    expect(screen.getAllByTestId('pillar-row')).toHaveLength(5);
  });

  it('shows balanced color (green) when diff <= 5', () => {
    render(<PillarBalanceChart data={mockData} />);
    // Product Education: 27% vs 25% = diff 2, balanced
    const percents = screen.getAllByTestId('pillar-percent');
    expect(percents[0].className).toContain('text-green-600');
  });

  it('shows under color (red) when actual < target by >5', () => {
    render(<PillarBalanceChart data={mockData} />);
    // Social Proof: 10% vs 20% = diff -10, under
    const percents = screen.getAllByTestId('pillar-percent');
    expect(percents[1].className).toContain('text-red-600');
  });

  it('shows over color (amber) when actual > target by >5', () => {
    render(<PillarBalanceChart data={mockData} />);
    // Industry Trends: 35% vs 20% = diff +15, over
    const percents = screen.getAllByTestId('pillar-percent');
    expect(percents[2].className).toContain('text-amber-600');
  });

  it('shows target marker for each pillar', () => {
    render(<PillarBalanceChart data={mockData} />);
    expect(screen.getAllByTestId('pillar-target-marker')).toHaveLength(5);
  });

  it('shows footer text', () => {
    render(<PillarBalanceChart data={mockData} />);
    expect(screen.getByText('Bars show actual %. Markers show ideal target.')).toBeInTheDocument();
  });

  it('renders empty state without footer', () => {
    render(<PillarBalanceChart data={[]} />);
    expect(
      screen.queryByText('Bars show actual %. Markers show ideal target.'),
    ).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<PillarBalanceChart data={mockData} className="custom" />);
    expect(screen.getByTestId('pillar-balance-chart').className).toContain('custom');
  });
});
