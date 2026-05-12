import { render, screen } from '@testing-library/react';

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApi.get(...args),
    post: (...args: unknown[]) => mockApi.post(...args),
    put: (...args: unknown[]) => mockApi.put(...args),
    patch: (...args: unknown[]) => mockApi.patch(...args),
    delete: (...args: unknown[]) => mockApi.delete(...args),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/businesses/biz1/pilot-health',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'biz1' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import Page from './page';

beforeEach(() => {
  mockApi.get.mockReset().mockResolvedValue({});
});

describe('Business pilot-health page', () => {
  it('renders day counter, scorecard rows, and metrics', async () => {
    mockApi.get.mockResolvedValueOnce({
      daysIntoPilot: 12,
      messagesHandled: 45,
      draftsApproved: 18,
      responseTimeMedianMinutes: 1.8,
      captured: { count: 6, revenue: 4200 },
      wouldHaveBeenMissed: { count: 9, revenue: 6300 },
      baseline: {
        monthlyBookings: 80,
        monthlyRevenue: 24500,
        capturedAt: '2026-05-01T00:00:00Z',
      },
      scorecard: {
        messagesHandled: { value: 45, target: 10, met: true },
        bookings: { value: 15, target: 7, met: true },
        continuationLogged: false,
      },
    });

    render(<Page />);

    expect(await screen.findByTestId('day-counter')).toHaveTextContent('Day 12 of 30');
    expect(screen.getByTestId('scorecard-messages')).toHaveTextContent('45 / 10');
    expect(screen.getByTestId('scorecard-bookings')).toHaveTextContent('15 / 7');
    expect(screen.getByTestId('scorecard-messages-met')).toBeInTheDocument();
    expect(screen.getByTestId('scorecard-bookings-met')).toBeInTheDocument();
    expect(screen.getByTestId('scorecard-continuation')).toHaveTextContent('TBD — manual');
  });

  it('caps the day counter at the pilot length', async () => {
    mockApi.get.mockResolvedValueOnce({
      daysIntoPilot: 90,
      messagesHandled: 5,
      draftsApproved: 0,
      responseTimeMedianMinutes: null,
      captured: { count: 0, revenue: 0 },
      wouldHaveBeenMissed: { count: 0, revenue: 0 },
      baseline: { monthlyBookings: null, monthlyRevenue: null, capturedAt: null },
      scorecard: {
        messagesHandled: { value: 5, target: 10, met: false },
        bookings: { value: 0, target: 5, met: false },
        continuationLogged: false,
      },
    });

    render(<Page />);

    expect(await screen.findByTestId('day-counter')).toHaveTextContent('Day 30 of 30');
    expect(screen.getByTestId('scorecard-messages-unmet')).toBeInTheDocument();
  });
});
