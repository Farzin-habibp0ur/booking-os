/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('@/components/skeleton', () => ({
  Skeleton: ({ className }) => <div data-testid="skeleton" className={className} />,
}));

import { render, screen } from '@testing-library/react';
import {
  QueuePageSkeleton,
  AgentsPageSkeleton,
  SequencesPageSkeleton,
  AnalyticsSkeleton,
} from './marketing-skeleton';

describe('MarketingSkeleton', () => {
  it('renders QueuePageSkeleton', () => {
    render(<QueuePageSkeleton />);
    expect(screen.getByTestId('queue-page-skeleton')).toBeInTheDocument();
  });

  it('renders AgentsPageSkeleton', () => {
    render(<AgentsPageSkeleton />);
    expect(screen.getByTestId('agents-page-skeleton')).toBeInTheDocument();
  });

  it('renders SequencesPageSkeleton', () => {
    render(<SequencesPageSkeleton />);
    expect(screen.getByTestId('sequences-page-skeleton')).toBeInTheDocument();
  });

  it('renders AnalyticsSkeleton', () => {
    render(<AnalyticsSkeleton />);
    expect(screen.getByTestId('analytics-skeleton')).toBeInTheDocument();
  });

  it('QueuePageSkeleton has pipeline and card sections', () => {
    render(<QueuePageSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it('AgentsPageSkeleton has stats strip and cards', () => {
    render(<AgentsPageSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it('SequencesPageSkeleton has sequence cards', () => {
    render(<SequencesPageSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('AnalyticsSkeleton has chart grid', () => {
    render(<AnalyticsSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});
